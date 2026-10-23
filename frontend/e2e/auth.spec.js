import { expect, test } from '@playwright/test';
import { loginAs, mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('customer@example.com');
  await page.getByLabel('Password').fill('nope-nope');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');
});

test('register validates passwords before calling the API', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Email', { exact: true }).fill('new@example.com');
  await page.getByLabel(/^Password/).fill('123');
  await page.getByLabel('Confirm password').fill('123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('Password must be at least 6 characters long.');

  await page.getByLabel(/^Password/).fill('secret123');
  await page.getByLabel('Confirm password').fill('secret124');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match.');
});

test('new user can register and is signed in', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Email', { exact: true }).fill('new@example.com');
  await page.getByLabel(/^Password/).fill('secret123');
  await page.getByLabel('Confirm password').fill('secret123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Your account has been created.')).toBeVisible();
});

test('protected pages redirect guests to sign in', async ({ page }) => {
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login$/);
});

test('session survives reload and logout clears it', async ({ page }) => {
  await loginAs(page, 'customer@example.com', 'customer123');
  await page.reload();
  await page.goto('/account');
  await expect(page.locator('.account-email')).toHaveText('customer@example.com');

  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto('/cart');
  await expect(page).toHaveURL(/\/login$/);
});
