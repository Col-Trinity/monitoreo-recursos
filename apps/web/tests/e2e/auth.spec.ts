import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";
import { verificationTokensTable, usersTable } from "@watchdog/db";
import { dbWrite } from "@watchdog/db";

test.describe("Auth flows", () => {
  test("signup happy path", async ({ page }) => {
    const db = dbWrite();
    const testEmail = `test-${Date.now()}@watchdog.test`;
    const testPassword = "password123";

    // Interceptamos Resend para no mandar emails reales
    await page.route("https://api.resend.com/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "fake-email-id" }),
      });
    });

    await page.goto("/auth/signup");
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.fill("#confirm", testPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/w\/.+/);
    // bucaMOS EL USER
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, testEmail));
    if (!user) throw new Error(`User not found for email: ${testEmail}`);

    // buscamos el token
    const [verificationToken] = await db
      .select()
      .from(verificationTokensTable)
      .where(eq(verificationTokensTable.userId, user.id));
    if (!verificationToken)
      throw new Error(`Verification token not found for user: ${user.id}`);

    await page.goto(`/api/auth/verify/${verificationToken.token}`);

    await expect(page).toHaveURL(/\/auth\/signin\?verified=true/);
  });

  test("login con credenciales ", async ({ page }) => {
    const db = dbWrite();
    const testEmail = `test-${Date.now()}@watchdog.test`;
    const testPassword = "password123";

    // Interceptamos Resend para no mandar emails reales
    await page.route("https://api.resend.com/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "fake-email-id" }),
      });
    });

    // creacion de usuario / signup
    await page.goto("/auth/signup");
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.fill("#confirm", testPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/w\/.+/);
    // verifica mail via db
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, testEmail));
    if (!user) throw new Error(`User not found for email: ${testEmail}`);

    const [verificationToken] = await db
      .select()
      .from(verificationTokensTable)
      .where(eq(verificationTokensTable.userId, user.id));
    if (!verificationToken)
      throw new Error(`Verification token not found for user: ${user.id}`);
    await page.goto(`/api/auth/verify/${verificationToken.token}`);

    //login
    await page.goto("/auth/signin");
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/w\/.+/);
  });

  test("password reset flow", async ({ page }) => {
    const db = dbWrite();
    const testEmail = `test-${Date.now()}@watchdog.test`;
    const testPassword = "password123";
    const repeatPassword = "newpassword123";

    // Interceptamos Resend para no mandar emails reales
    await page.route("https://api.resend.com/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "fake-email-id" }),
      });
    });

    // Signup
    await page.goto("/auth/signup");
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.fill("#confirm", testPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/w\/.+/);
    // Verify email via DB
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, testEmail));
    if (!user) throw new Error(`User not found for email: ${testEmail}`);

    const [verificationToken] = await db
      .select()
      .from(verificationTokensTable)
      .where(eq(verificationTokensTable.userId, user.id));
    if (!verificationToken)
      throw new Error(`Verification token not found for user: ${user.id}`);

    await page.goto(`/api/auth/verify/${verificationToken.token}`);
    await expect(page).toHaveURL(/\/auth\/signin\?verified=true/);

    // Request password reset
    await page.goto("/auth/forgot");
    await page.fill("#email", testEmail);
    await page.click('button[type="submit"]');
    await expect(page.getByText("Revisá tu email")).toBeVisible();

    // Get reset token from DB
    const [resetToken] = await db
      .select()
      .from(verificationTokensTable)
      .where(eq(verificationTokensTable.userId, user.id));
    if (!resetToken)
      throw new Error(`Reset token not found for user: ${user.id}`);

    // Reset password
    await page.goto(`/auth/reset/${resetToken.token}`);
    await page.fill("#password", repeatPassword);
    await page.fill("#confirm", repeatPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/auth/signin?reset=true");

    // Login with new password
    await page.goto("/auth/signin");
    await page.fill("#email", testEmail);
    await page.fill("#password", repeatPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/w\/.+/);
  });
});
