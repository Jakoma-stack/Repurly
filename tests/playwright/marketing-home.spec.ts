import { expect, test } from '@playwright/test';

const legacyPricing = /Solo|Team|Agency|£19|£49|£59|£199|£499/;

test.describe('marketing home', () => {
  test('shows the premium LinkedIn positioning and commercial pricing', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Premium LinkedIn content operations')).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: /Run LinkedIn publishing with one premium system for drafting, approvals, scheduling, and recovery\./,
      }),
    ).toBeVisible();
    await expect(page.getByText('Approval and routing control')).toBeVisible();
    await expect(page.getByText('Pricing for focused teams that need a premium workflow, not a bloated suite')).toBeVisible();

    await expect(page.getByText('Core', { exact: true })).toBeVisible();
    await expect(page.getByText('£297/mo')).toBeVisible();
    await expect(page.getByText('Growth', { exact: true })).toBeVisible();
    await expect(page.getByText('£697/mo')).toBeVisible();
    await expect(page.getByText('Scale', { exact: true })).toBeVisible();
    await expect(page.getByText('Custom', { exact: true })).toBeVisible();

    await expect(page.locator('body')).not.toContainText(legacyPricing);
    await expect(page.getByRole('link', { name: 'Start Core' })).toHaveAttribute('href', '/sign-up?plan=core');
    await expect(page.getByRole('link', { name: 'Start Growth' })).toHaveAttribute('href', '/sign-up?plan=growth');
  });
});
