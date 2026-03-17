import { test, expect, type Locator } from '@playwright/test';

async function waitForExampleButton(section: Locator, name: RegExp) {
  const button = section.getByRole('button', { name });
  await expect(button).toBeVisible({ timeout: 15000 });
  await expect(button).toBeEnabled({ timeout: 15000 });
  return button;
}

test.describe('Fit Assessment', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display fit assessment section', async ({ page }) => {
    await expect(page.locator('#fit-assessment')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fit Assessment' })).toBeVisible();
  });

  test('should display example buttons and form elements', async ({ page }) => {
    const section = page.locator('#fit-assessment');

    // Example buttons
    await expect(section.getByRole('button', { name: /strong fit example/i })).toBeVisible();
    await expect(section.getByRole('button', { name: /weak fit example/i })).toBeVisible();

    // Textarea
    await expect(section.getByRole('textbox', { name: /job description/i })).toBeVisible();

    // Submit button (should be disabled when textarea is empty)
    const analyzeButton = section.getByRole('button', { name: /analyze fit/i });
    await expect(analyzeButton).toBeVisible();
    await expect(analyzeButton).toBeDisabled();
  });

  test('should navigate to fit assessment section via nav link', async ({ page, isMobile }) => {
    // Skip on mobile - navigation is hidden behind hamburger menu
    test.skip(isMobile, 'Navigation links are hidden on mobile');

    await page.getByRole('link', { name: /fit assessment/i }).first().click();
    await expect(page.locator('#fit-assessment')).toBeInViewport();
  });

  test('should populate textarea with strong fit example', async ({ page }) => {
    const section = page.locator('#fit-assessment');

    const strongFitButton = await waitForExampleButton(section, /strong fit example/i);

    // Click strong fit example
    await strongFitButton.click();

    // Verify textarea is populated with content
    const textarea = section.getByRole('textbox', { name: /job description/i });
    await expect(textarea).toContainText('Engineering Manager');

    // Analyze button should be enabled now
    await expect(section.getByRole('button', { name: /analyze fit/i })).toBeEnabled();
  });

  test('should populate textarea with weak fit example', async ({ page }) => {
    const section = page.locator('#fit-assessment');

    const weakFitButton = await waitForExampleButton(section, /weak fit example/i);

    // Click weak fit example
    await weakFitButton.click();

    // Verify textarea is populated with content
    const textarea = section.getByRole('textbox', { name: /job description/i });
    await expect(textarea).toContainText('Staff Frontend Engineer');

    // Analyze button should be enabled now
    await expect(section.getByRole('button', { name: /analyze fit/i })).toBeEnabled();
  });

  test('should enable analyze button when textarea has content', async ({ page }) => {
    const section = page.locator('#fit-assessment');
    const textarea = section.getByRole('textbox', { name: /job description/i });
    const analyzeButton = section.getByRole('button', { name: /analyze fit/i });

    // Initially disabled
    await expect(analyzeButton).toBeDisabled();

    // Type into textarea
    await textarea.fill('Engineering Manager role at a tech company');

    // Now should be enabled
    await expect(analyzeButton).toBeEnabled();
  });
});
