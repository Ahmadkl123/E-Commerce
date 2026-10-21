import { expect, test } from '@playwright/test';
import { loginAs, mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('customer@example.com');
  await page.getByLabel('Password').fill('nope-nope');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Invalid email or password.')).toBeVisible();
});

test('register validates passwords before calling the API', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Email').fill('new@example.com');
  await page.getByLabel('Password', { exact: true }).fill('123');
  await page.getByLabel('Confirm password').fill('123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Password must be at least 6 characters long.')).toBeVisible();

  await page.getByLabel('Password', { exact: true }).fill('secret123');
  await page.getByLabel('Confirm password').fill('secret124');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Passwords do not match.')).toBeVisible();
});

test('new user can register and is signed in', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Email').fill('new@example.com');
  await page.getByLabel('Password', { exact: true }).fill('secret123');
  await page.getByLabel('Confirm password').fill('secret123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Account created. Welcome to Nova Store!')).toBeVisible();
});

test('protected pages redirect guests to login', async ({ page }) => {
  await page.goto('/orders');
  await expect(page).toHaveURL(/\/login$/);
});

test('session survives reload and logout clears it', async ({ page, isMobile }) => {
  await loginAs(page, 'customer@example.com', 'customer123');
  await page.reload();
  if (isMobile) await page.getByRole('button', { name: 'Toggle menu' }).click();
  await expect(page.getByText('customer@example.com')).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto('/cart');
  await expect(page).toHaveURL(/\/login$/);
});
