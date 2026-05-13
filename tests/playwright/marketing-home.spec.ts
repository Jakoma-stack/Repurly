import { expect, test } from '@playwright/test';

const legacyPricing = /Solo|Team|Agency|£19|£49|£59|£199|£297\/mo|£697\/mo|£499/;

test.describe('marketing home', () => {
  test('shows Growth OS positioning and current commercial pricing', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('LinkedIn-led revenue workflow · human-in-the-loop')).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: /Turn expertise into LinkedIn-led campaigns, lead conversations, and booked-call workflows\./,
      }),
    ).toBeVisible();
    await expect(page.getByText('Campaign and approval control')).toBeVisible();
    await expect(page.getByText('Pricing for operators who need a revenue workflow, not another cheap scheduler')).toBeVisible();

    await expect(page.getByText('Starter', { exact: true })).toBeVisible();
    await expect(page.getByText('£79/mo')).toBeVisible();
    await expect(page.getByText('Operator', { exact: true })).toBeVisible();
    await expect(page.getByText('£249/mo')).toBeVisible();
    await expect(page.getByText('Studio', { exact: true })).toBeVisible();
    await expect(page.getByText('From £699/mo')).toBeVisible();

    await expect(page.locator('body')).not.toContainText(legacyPricing);
    await expect(page.getByRole('link', { name: 'Start Starter' })).toHaveAttribute('href', '/sign-up?plan=core');
    await expect(page.getByRole('link', { name: 'Start Operator' })).toHaveAttribute('href', '/sign-up?plan=growth');
  });
});
