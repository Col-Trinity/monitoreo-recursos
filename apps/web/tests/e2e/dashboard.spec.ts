import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";
import { verificationTokensTable, usersTable, agentsTable } from "@watchdog/db";
import { dbWrite } from "@watchdog/db";
import http from "http";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const TYPES = ["cpu", "memory", "disk", "network"] as const;

function buildMetricLine(type: string, host: string) {
  const base = { host, timestamp: Date.now() };
  const values: Record<string, object> = {
    cpu: { usage: Math.random() * 100 },
    memory: {
      used: 1000,
      available: 1000,
      cached: 100,
      total: 2000,
      usedPercent: Math.random() * 100,
    },
    disk: {
      path: "/",
      used: 1000,
      total: 2000,
      free: 1000,
      usedPercent: Math.random() * 100,
    },
    network: {
      name: "eth0",
      rx: Math.random() * 1_000_000,
      tx: Math.random() * 1_000_000,
      latency: Math.random() * 100,
    },
  };
  return JSON.stringify({
    hostname: host,
    timestamp: Date.now(),
    metrics: [{ type, ...base, value: values[type] }],
  });
}

function sendMetrics(apiKey: string, lines: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${API_URL}/metrics/stream`);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/x-ndjson",
          "Content-Length": Buffer.byteLength(lines),
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`API respondio con ${res.statusCode}`));
        } else {
          resolve();
        }
      },
    );
    req.on("error", reject);
    req.write(lines);
    req.end();
  });
}

test.describe("Dashboard e2e: signup -> ver metrica", () => {
  test("happy path completo", async ({ page }) => {
    const db = dbWrite();
    const testEmail = `test-${Date.now()}@watchdog.test`;
    const testPassword = "password123";

    // 1. Interceptar Resend para no mandar emails reales
    await page.route("https://api.resend.com/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "fake-email-id" }),
      });
    });

    // 2. Signup
    await page.goto("/auth/signup");
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.fill("#confirm", testPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/w\/.+/);

    // 3. Verificar email via DB
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, testEmail));
    if (!user) throw new Error(`Usuario no encontrado: ${testEmail}`);

    const [verificationToken] = await db
      .select()
      .from(verificationTokensTable)
      .where(eq(verificationTokensTable.userId, user.id));
    if (!verificationToken)
      throw new Error(`Token no encontrado para: ${user.id}`);

    await page.goto(`/api/auth/verify/${verificationToken.token}`);
    await expect(page).toHaveURL(/\/auth\/signin\?verified=true/);

    // 4. Login
    await page.goto("/auth/signin");
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/w\/.+/);

    // 5. Obtener workspaceId de la URL
    const currentUrl = page.url();
    const workspaceId = currentUrl.match(/\/w\/([^/]+)/)?.[1];
    if (!workspaceId)
      throw new Error("No se pudo obtener workspaceId de la URL");

    // 6. Crear agente via settings
    await page.goto(`/w/${workspaceId}/settings/workspace/agents`);
    await page.fill("#name", "agente-e2e");
    await page.click('button:has-text("Crear agente")');

    // Esperar que aparezca la API key en la UI
    await expect(page.locator("text=wd_").first()).toBeVisible({
      timeout: 10000,
    });

    // 7. Obtener API key de la UI (en DB ya esta hasheada)
    const apiKeyElement = page
      .locator("code")
      .filter({ hasText: "wd_" })
      .first();
    const apiKey = await apiKeyElement.textContent();
    if (!apiKey) throw new Error("No se pudo obtener la API key de la UI");

    // 8. Mandar 10 metricas al endpoint
    // Nota: cada host distinto evita colisionar con el indice unico
    // uniq_metrics (createdAt, agentId, metricsType, hostname) — createdAt
    // usa defaultNow(), que en un mismo INSERT batch es igual para todas
    // las filas, asi que puntos del mismo host/tipo en el mismo flush del
    // worker se pisan entre si via onConflictDoNothing().
    const lines = [
      ...TYPES.map((t) => buildMetricLine(t, `e2e-host`)),
      ...TYPES.map((t, i) => buildMetricLine(t, `e2e-host-b${i}`)),
      buildMetricLine("cpu", "e2e-host-c1"),
      buildMetricLine("cpu", "e2e-host-c2"),
    ].join("\n");

    await sendMetrics(apiKey, lines);

    // 9. Esperar que el worker procese las metricas (flush cada 5s)
    await page.waitForTimeout(6000);

    // 10. Navegar al dashboard y verificar charts
    await page.goto(`/w/${workspaceId}/dashboard`);

    await expect(page.locator("text=Cargando...")).toHaveCount(0, {
      timeout: 15000,
    });

    await expect(page.locator("text=agente-e2e")).toBeVisible();

    await expect(page.locator("path.recharts-curve").first()).toBeVisible({
      timeout: 10000,
    });
  });
});
