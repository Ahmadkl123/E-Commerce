import { expect, test } from '@playwright/test';
import { loginAs, mockApi } from './mock-api';

let db;
test.beforeEach(async ({ page }) => {
  db = await mockApi(page);
});

// 2x2 red PNG, used to test photo uploads.
const RED_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==',
  'base64'
);

test('customers cannot open the admin dashboard', async ({ page }) => {
  await loginAs(page, 'customer@example.com', 'customer123');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Access restricted' })).toBeVisible();
});

test('admin sees inventory stats and can filter by stock', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Add product' }).click();
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
  await page.getByRole('button', { name: 'Add product' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Broken');
  await dialog.getByLabel('Price (USD)').fill('-5');
  await dialog.getByLabel('Stock').fill('1');
  await dialog.getByRole('button', { name: 'Create product' }).click();
  await expect(dialog.getByText('Price must be a positive number.')).toBeVisible();
});

test('admin can upload a product photo that is saved with the product', async ({ page }) => {
  await loginAs(page, 'admin@example.com', 'admin123');
  await page.getByRole('button', { name: 'Add product' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Desk Lamp');
  await dialog.getByLabel('Price (USD)').fill('24');
  await dialog.getByLabel('Stock').fill('12');

  await dialog.getByLabel('Upload product photo').setInputFiles({
    name: 'lamp.png',
    mimeType: 'image/png',
    buffer: RED_PNG,
  });
  await expect(dialog.getByRole('img', { name: 'Product photo preview' })).toBeVisible();
  await expect(dialog.getByText('Uploaded photo')).toBeVisible();

  await dialog.getByRole('button', { name: 'Create product' }).click();
  await expect(dialog).toBeHidden();

  const saved = db.products.find((p) => p.name === 'Desk Lamp');
  expect(saved.image_url).toMatch(/^data:image\/jpeg;base64,/);

  const row = page.getByTestId('inventory-row').filter({ hasText: 'Desk Lamp' });
  await expect(row.locator('img')).toHaveAttribute('src', saved.image_url);
});

test('product form rejects files that are not pictures', async ({ page }) => {
  await loginAs(page, 'admin@example.com', 'admin123');
  await page.getByRole('button', { name: 'Add product' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Upload product photo').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  });
  await expect(dialog.getByText('Please choose a JPEG, PNG, WebP or GIF picture.')).toBeVisible();
});
