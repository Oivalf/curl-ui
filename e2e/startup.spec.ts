import { test, expect } from '@playwright/test';

/**
 * Basic E2E tests for App Startup.
 * 
 * NOTE: To run these tests against a Tauri app, you typically need to build 
 * the app and use a WebDriver/tauri-driver. For local development, 
 * these can be run against the Vite dev server at http://localhost:1420.
 */
test.describe('App Startup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
  });

  test('displays welcome screen heading', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    // Match "Welcome to cURL-UI" regardless of minor i18n variations
    await expect(heading).toContainText(/Welcome/i);
  });

  test('shows action buttons', async ({ page }) => {
    const newProjectBtn = page.getByRole('button', { name: /New Project/i });
    const userGuideBtn = page.getByRole('button', { name: /User Guide/i });
    
    await expect(newProjectBtn).toBeVisible();
    await expect(userGuideBtn).toBeVisible();
  });

  test('can open new project prompt modal', async ({ page }) => {
    const newProjectBtn = page.getByRole('button', { name: /New Project/i });
    await newProjectBtn.click();
    
    // The PromptModal displays "Enter Project Name:"
    const promptLabel = page.getByText(/Enter Project Name/i);
    await expect(promptLabel).toBeVisible();
  });
});
