import { expect, test } from '@playwright/test';

test('landing loads and shows main heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'مسار المحامي' }).first()).toBeVisible();
});

test('hero CTA scrolls to trial section', async ({ page }) => {
  await page.goto('/');
  const trialCta = page.locator('a[href$="#trial"]').first();
  await expect(trialCta).toBeVisible();
  await trialCta.click();
  await expect(page).toHaveURL(/#trial$/);
  await expect(page.locator('#trial')).toBeVisible();
});

test('contact page loads', async ({ page }) => {
  await page.goto('/contact');
  await expect(page.getByRole('heading', { name: 'تواصل معنا' })).toBeVisible();
});
