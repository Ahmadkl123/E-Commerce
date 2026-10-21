import { expect, test } from '@playwright/test';
import { loginAs, mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('catalog lists products from the API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Gear that keeps up/ })).toBeVisible();
  await expect(page.getByTestId('product-card')).toHaveCount(5);
});

test('search filters the catalog', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Search products').fill('keyboard');
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await expect(page.getByTestId('product-card')).toContainText('Mechanical Gaming Keyboard');

  await page.getByLabel('Search products').fill('zzz-nothing');
  await expect(page.getByText('No products found')).toBeVisible();
});

test('in-stock filter hides sold-out items', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('product-card')).toHaveCount(5);
  await page.getByLabel('In stock only').check();
  await expect(page.getByTestId('product-card')).toHaveCount(4);
});

test('product detail page shows stock status', async ({ page }) => {
  await page.goto('/products/4');
  await expect(page.getByRole('heading', { name: /Curved Gaming Monitor/ })).toBeVisible();
  await expect(page.getByText('Only 5 left')).toBeVisible();
  await expect(page.getByText('$429.00')).toBeVisible();
});

test('guests are sent to login when adding to cart', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add Mechanical Gaming Keyboard to cart' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('customer can add to cart, change quantity, and check out', async ({ page }) => {
  await loginAs(page, 'customer@example.com', 'customer123');

  await page.goto('/products/2');
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText('Added 2 × Mechanical Gaming Keyboard to cart')).toBeVisible();

  await page.goto('/cart');
  await expect(page.getByTestId('cart-item')).toHaveCount(1);
  await expect(page.getByTestId('cart-total')).toHaveText('$159.98');

  await page.getByRole('button', { name: 'Decrease quantity' }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('$79.99');

  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByTestId('order')).toHaveCount(1);
  await expect(page.getByTestId('order')).toContainText('Mechanical Gaming Keyboard');
});

test('cart shows empty state after removing the last item', async ({ page }) => {
  await loginAs(page, 'customer@example.com', 'customer123');
  await page.goto('/products/1');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText(/Added 1 ×/)).toBeVisible();

  await page.goto('/cart');
  await page.getByRole('button', { name: /^Remove / }).click();
  await expect(page.getByText('Your cart is empty')).toBeVisible();
});
