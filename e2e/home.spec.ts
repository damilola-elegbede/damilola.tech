import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the hero section', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Damilola Elegbede');
    await expect(page.getByText('Engineering Manager')).toBeVisible();
    await expect(
      page.getByText('Building high-performance organizations that deliver enterprise-scale solutions')
    ).toBeVisible();
  });

  test('should display the CTA button in hero', async ({ page }) => {
    await expect(page.getByRole('button', { name: /ask ai about me/i })).toBeVisible();
  });

  test('should display all main sections', async ({ page }) => {
    // Hero
    await expect(page.locator('#hero')).toBeVisible();

    // Experience
    await expect(page.locator('#experience')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Experience' })).toBeVisible();

    // Skills Assessment
    await expect(page.locator('#skills-assessment')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Skills Assessment' })).toBeVisible();

    // Education
    await expect(page.locator('#education')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Education' })).toBeVisible();

    // Contact (footer)
    await expect(page.locator('#contact')).toBeVisible();
  });

  test('should display experience entries', async ({ page }) => {
    await expect(page.getByText('Verily Life Sciences')).toBeVisible();
    await expect(page.getByText('Qualcomm Technologies').first()).toBeVisible();
  });

  test('should display skills assessment cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Strong' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Moderate' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gaps' })).toBeVisible();
  });

  test('should display education entries', async ({ page }) => {
    await expect(page.getByText('MBA')).toBeVisible();
    await expect(page.getByText('MS Computer Science')).toBeVisible();
  });

  test('should display contact links in footer', async ({ page }) => {
    await expect(page.getByRole('link', { name: /linkedin/i })).toBeVisible();
    await expect(page.getByText('Boulder, CO')).toBeVisible();
  });

  test('should have correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Damilola Elegbede/);
  });
});

test.describe('Experience Section Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display experience highlights', async ({ page }) => {
    // Check that highlights are visible for the first experience
    await expect(page.getByText(/enterprise-wide GCP cloud transformation/i)).toBeVisible();
  });

  test('should show expand button for experiences with many bullets', async ({ page }) => {
    // The Verily entry has 6 bullets, so should show "Show 3 more" button
    await expect(page.getByRole('button', { name: /show 3 more/i }).first()).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display navigation links', async ({ page }) => {
    await expect(page.getByRole('link', { name: /experience/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /skills/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /education/i }).first()).toBeVisible();
  });

  test('should not display contact in navigation', async ({ page }) => {
    // Contact should NOT be in the main nav (only 3 items)
    const navLinks = page.locator('nav a');
    const count = await navLinks.count();
    // Desktop nav has 3 links (Experience, Skills, Education)
    expect(count).toBe(3);
  });
});
