import { expect, test } from '@playwright/test';
import { loginAs, mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('customers cannot open the admin dashboard', async ({ page }) => {
  await loginAs(page, 'customer@example.com', 'customer123');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admins only' })).toBeVisible();
});

test('admin sees inventory stats and can filter low stock', async ({ page }) => {
  await loginAs(page, 'admin@example.com', 'admin123');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId('stat-products')).toHaveText('5');
  await expect(page.getByTestId('inventory-row')).toHaveCount(5);

  await page.getByRole('button', { name: 'Low stock' }).click();
  await expect(page.getByTestId('inventory-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Out of stock' }).click();
  await expect(page.getByTestId('inventory-row')).toHaveCount(1);
});

test('admin can create, edit and delete a product', async ({ page }) => {
  await loginAs(page, 'admin@example.com', 'admin123');

  // Create
  await page.getByRole('button', { name: '+ New product' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Wireless Gaming Mouse');
  await dialog.getByLabel('Description').fill('Ultra-fast sensor');
  await dialog.getByLabel('Price (USD)').fill('59.99');
  await dialog.getByLabel('Stock').fill('35');
  await dialog.getByRole('button', { name: 'Create product' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('stat-products')).toHaveText('6');

  // Edit
  const row = page.getByTestId('inventory-row').filter({ hasText: 'Wireless Gaming Mouse' });
  await row.getByRole('button', { name: 'Edit' }).click();
  await dialog.getByLabel('Stock').fill('3');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(row).toContainText('Only 3 left');

  // Delete
  page.once('dialog', (d) => d.accept());
  await row.getByRole('button', { name: 'Delete Wireless Gaming Mouse' }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByTestId('stat-products')).toHaveText('5');
});

test('product form validates input', async ({ page }) => {
  await loginAs(page, 'admin@example.com', 'admin123');
  await page.getByRole('button', { name: '+ New product' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Broken');
  await dialog.getByLabel('Price (USD)').fill('-5');
  await dialog.getByLabel('Stock').fill('1');
  await dialog.getByRole('button', { name: 'Create product' }).click();
  await expect(dialog.getByText('Price must be a positive number.')).toBeVisible();
});
