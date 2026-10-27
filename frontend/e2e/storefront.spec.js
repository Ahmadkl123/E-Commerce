import { expect, test } from '@playwright/test';
import { loginAs, mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('home page shows hero, categories and products', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Better tools for the way you work.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible();
  await expect(page.getByTestId('product-card').first()).toBeVisible();
});

test('shop lists every product from the API', async ({ page }) => {
  await page.goto('/shop');
  await expect(page.getByRole('heading', { name: 'All products', level: 1 })).toBeVisible();
  await expect(page.getByTestId('product-card')).toHaveCount(5);
  await expect(page.getByText('5 products')).toBeVisible();
});

test('header search finds products', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByLabel('Search products').fill('keyboard');
  await page.getByLabel('Search products').press('Enter');
  await expect(page).toHaveURL(/\/shop\?q=keyboard/);
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await expect(page.getByTestId('product-card')).toContainText('Mechanical Gaming Keyboard');

  await page.goto('/shop?q=zzz-nothing');
  await expect(page.getByText('No products found')).toBeVisible();
});

test('category and stock filters narrow the catalog', async ({ page }) => {
  await page.goto('/shop?category=audio');
  await expect(page.getByRole('heading', { name: 'Audio', level: 1 })).toBeVisible();
  await expect(page.getByTestId('product-card')).toHaveCount(2);

  // The filter lives in the URL, which React Router updates in a transition,
  // so click and then wait for the state rather than using check().
  await page.getByLabel('In stock only').click();
  await expect(page.getByLabel('In stock only')).toBeChecked();
  await expect(page).toHaveURL(/stock=1/);
  await expect(page.getByTestId('product-card')).toHaveCount(1);
});

test('product page shows price and stock status', async ({ page }) => {
  await page.goto('/products/4');
  await expect(page.getByRole('heading', { name: /Curved Gaming Monitor/ })).toBeVisible();
  await expect(page.getByText('Only 5 left')).toBeVisible();
  await expect(page.locator('.pdp-price')).toHaveText('$429.00');
  await expect(page.getByRole('img', { name: /Curved Gaming Monitor/ })).toBeVisible();
});

test('sold-out products cannot be added', async ({ page }) => {
  await page.goto('/products/5');
  await expect(page.getByRole('button', { name: 'Sold out' })).toBeDisabled();
});

test('guests are sent to sign in when adding to cart', async ({ page }) => {
  await page.goto('/shop');
  await page.getByRole('button', { name: 'Add Mechanical Gaming Keyboard to cart' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('adding from the grid opens the cart drawer', async ({ page }) => {
  await loginAs(page, 'customer@example.com', 'customer123');
  await page.goto('/shop');
  await page.getByRole('button', { name: 'Add Ergonomic Wireless Mouse to cart' }).click();

  const drawer = page.getByRole('dialog', { name: 'Shopping cart' });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('Ergonomic Wireless Mouse');
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});

test('customer can change quantity and check out', async ({ page }) => {
  await loginAs(page, 'customer@example.com', 'customer123');

  await page.goto('/products/2');
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText('Added 2 × Mechanical Gaming Keyboard to your cart')).toBeVisible();

  await page.goto('/cart');
  await expect(page.getByTestId('cart-item')).toHaveCount(1);
  await expect(page.getByTestId('cart-total')).toHaveText('$159.98');

  await page.getByRole('button', { name: 'Decrease quantity' }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('$79.99');

  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByTestId('checkout-total')).toHaveText('$79.99');

  await page.getByLabel('Card number').fill('4242424242424242');
  await expect(page.getByLabel('Card number')).toHaveValue('4242 4242 4242 4242');
  await page.getByLabel('Name on card').fill('Sam Customer');
  await page.getByLabel('Expiry date').fill('1230');
  await page.getByLabel('Security code').fill('123');
  await page.getByRole('button', { name: 'Pay $79.99' }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId('order')).toHaveCount(1);
  await expect(page.getByTestId('order')).toContainText('paid');
  await expect(page.locator('.order-detail')).toContainText('Mechanical Gaming Keyboard');
  await expect(page.locator('.order-detail')).toContainText('Paid with Visa •••• 4242');
});

async function goToCheckout(page) {
  await loginAs(page, 'customer@example.com', 'customer123');
  await page.goto('/products/3');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText(/Added 1 ×/)).toBeVisible();
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page).toHaveURL(/\/checkout$/);
}

test('checkout rejects an invalid card and never sends the card number', async ({ page }) => {
  const db = await mockApi(page);
  await goToCheckout(page);

  await page.getByLabel('Card number').fill('4242424242424241');
  await page.getByLabel('Name on card').fill('Sam Customer');
  await page.getByLabel('Expiry date').fill('1230');
  await page.getByLabel('Security code').fill('123');
  await page.getByRole('button', { name: /^Pay / }).click();
  await expect(page.getByText('Please enter a valid card number.')).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
  expect(db.orders).toHaveLength(0);

  await page.getByLabel('Card number').fill('5555555555554444');
  await page.getByRole('button', { name: /^Pay / }).click();
  await expect(page).toHaveURL(/\/account$/);
  expect(db.lastPayment).toEqual({ method: 'card', cardBrand: 'Mastercard', cardLast4: '4444' });
});

test('customer can pay with PayPal', async ({ page }) => {
  await goToCheckout(page);
  await page.locator('.pay-method strong', { hasText: 'PayPal' }).click();
  await expect(page.getByLabel('PayPal email')).toHaveValue('customer@example.com');
  await page.getByRole('button', { name: 'Pay $39.50 with PayPal' }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator('.order-detail')).toContainText('Paid with PayPal (customer@example.com)');
});

test('customer can pay with Google Pay', async ({ page }) => {
  await goToCheckout(page);
  await page.locator('.pay-method strong', { hasText: 'Google Pay' }).click();
  await page.getByRole('button', { name: 'Pay $39.50 with Google Pay' }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator('.order-detail')).toContainText('Paid with Google Pay');
});

test('cart shows empty state after removing the last item', async ({ page }) => {
  await loginAs(page, 'customer@example.com', 'customer123');
  await page.goto('/products/1');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText(/Added 1 ×/)).toBeVisible();

  await page.goto('/cart');
  await page.getByRole('button', { name: /^Remove / }).click();
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
});
