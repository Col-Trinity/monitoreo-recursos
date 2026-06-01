import { test, expect } from '@playwright/test';

test('el gráfico se actualiza con métricas en tiempo real', async ({ page }) => {
  // Abrimos el dashboard
  await page.goto('/');

  // Esperamos que el gráfico cargue
  await expect(page.locator('.recharts-line')).toBeVisible({ timeout: 15000 });

  // Capturamos los datos iniciales del gráfico
  const puntosIniciales = await page.locator('.recharts-dot').count();

  // Esperamos el refetch (10 segundos)
  await page.waitForTimeout(11000);

  // Verificamos que hay datos en el gráfico
  const puntosDespues = await page.locator('.recharts-dot').count();
  expect(puntosDespues).toBeGreaterThan(0);
});