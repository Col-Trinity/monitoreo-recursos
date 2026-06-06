import { test, expect } from "@playwright/test";

const METRIC_LABELS = ["CPU (%)", "Memoria (%)", "Disco (%)", "Red (bytes)"];

test("todos los charts muestran datos en tiempo real del agente", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Watch-Dog — Métricas en tiempo real" }),
  ).toBeVisible();

  // Esperar que la query a la DB termine (desaparece el spinner)
  await expect(page.locator("text=Cargando...")).not.toBeVisible({
    timeout: 10000,
  });

  // Los 4 charts deben tener título y una línea dibujada con datos reales
  for (const label of METRIC_LABELS) {
    const section = page
      .locator("div")
      .filter({ has: page.getByRole("heading", { name: label }) })
      .first();

    await expect(section.getByRole("heading", { name: label })).toBeVisible();

    // recharts dibuja path.recharts-curve solo cuando hay puntos de datos
    await expect(section.locator("path.recharts-curve").first()).toBeVisible();
  }
});
