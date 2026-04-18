import { expect, test } from '@playwright/test';

test.describe('marketing home', () => {
  test('shows the premium LinkedIn positioning', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Premium LinkedIn content operations')).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: /Run LinkedIn publishing with one premium system for drafting, approvals, scheduling, and recovery\./,
      }),
    ).toBeVisible();
    await expect(page.getByText('Approval and routing control')).toBeVisible();
    await expect(page.getByText('Pricing for focused teams that need a premium workflow, not a bloated suite')).toBeVisible();
  });
});
