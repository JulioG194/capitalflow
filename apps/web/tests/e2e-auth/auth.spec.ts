import { test, expect } from "@playwright/test";
import { API_E2E_BASE_URL, e2eEmail } from "./support/constants";
import { waitForResetToken } from "./support/reset-link";

/**
 * Spec 002 (`specs/002-auth-users.md`), section 8's Playwright plan. Runs
 * against a live `apps/api` process (see `playwright.auth.config.ts` /
 * `support/global-setup.ts`) — unlike spec 001's landing-page e2e suite,
 * these flows genuinely need a real backend + database, since they
 * exercise real registration, session cookies, and (for the third flow)
 * the actual `ConsoleEmailAdapter` console output.
 */

test.describe("register → login → view /app/profile → edit name → logout", () => {
  const email = e2eEmail("register-flow");
  const password = "Password123";
  const updatedName = "Ada Actualizada";

  test("completes the full account lifecycle through the UI", async ({
    page,
  }) => {
    // --- Register (AC1, AC36) ---
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Ada Lovelace");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // Registration issues no session (AC1) — RegisterForm redirects to
    // /login rather than straight into the app.
    await expect(page).toHaveURL(/\/login\?registered=1$/);
    await expect(
      page.getByText("Cuenta creada. Ahora inicia sesión."),
    ).toBeVisible();

    // --- Log in (AC6, AC41) ---
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/app\/profile$/);

    // --- View /app/profile (AC40) ---
    await expect(
      page.getByRole("heading", { name: "Mi perfil" }),
    ).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    const nameInput = page.getByLabel("Nombre");
    await expect(nameInput).toHaveValue("Ada Lovelace");

    // --- Edit name (AC28, AC40) ---
    await nameInput.fill(updatedName);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Perfil actualizado.")).toBeVisible();
    await expect(nameInput).toHaveValue(updatedName);

    // Reload to prove the new name was actually persisted server-side
    // (via PATCH /auth/me), not just held in local component state.
    await page.reload();
    await expect(page.getByLabel("Nombre")).toHaveValue(updatedName);

    // --- Log out (AC42) ---
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("unauthenticated access to /app/*", () => {
  test("redirects to /login, preserving the original path as ?redirect= (AC39)", async ({
    page,
  }) => {
    await page.goto("/app/profile");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fapp%2Fprofile$/);
  });
});

test.describe("forgot password → reset → old session invalidated → new login succeeds", () => {
  const email = e2eEmail("reset-flow");
  const oldPassword = "OldPassword123";
  const newPassword = "NewPassword456";

  test("resets the password via the emailed link and revokes the prior session (AC20-25, AC34)", async ({
    page,
  }) => {
    // Register, then log in with the original password so there's an
    // existing refresh-token session (cookie) to later prove gets
    // invalidated by the reset (AC22).
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Grace Hopper");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(oldPassword);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/login\?registered=1$/);

    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(oldPassword);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/app\/profile$/);

    // --- Forgot password (AC20) ---
    await page.goto("/forgot-password");
    await page.getByLabel("Correo electrónico").fill(email);
    await page
      .getByRole("button", { name: "Enviar enlace de recuperación" })
      .click();
    await expect(page.getByText(/Si ese correo existe/)).toBeVisible();

    // AC34: the only concrete `EmailService` in this spec logs the
    // recipient/subject/reset-link to the server console instead of
    // sending a real email — this is the sole way to observe the raw
    // reset token, since only its SHA-256 hash is ever persisted (spec
    // 002 section 4). `global-setup.ts` pipes the live process's stdout
    // to a log file this helper polls.
    const token = await waitForResetToken(email);

    // --- Reset password (AC22) ---
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel("Nueva contraseña").fill(newPassword);
    await page
      .getByRole("button", { name: "Actualizar contraseña" })
      .click();
    await expect(
      page.getByText("Tu contraseña fue actualizada."),
    ).toBeVisible();

    // AC22: resetting the password revokes *all* existing refresh tokens
    // for the user. The pre-reset refresh-token cookie is still sitting
    // in this browser context (reset-password never touches cookies) —
    // presenting it to /auth/refresh now must fail.
    const refreshWithOldSession = await page
      .context()
      .request.post(`${API_E2E_BASE_URL}/auth/refresh`);
    expect(refreshWithOldSession.status()).toBe(401);

    // --- New login with the new password succeeds ---
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(newPassword);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/app\/profile$/);
    await expect(page.getByText(email)).toBeVisible();
  });
});
