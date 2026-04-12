import { test, expect } from '@playwright/test';

test.describe('Variable Inheritance UI', () => {
    test.beforeEach(async ({ page }) => {
        // Mock Tauri APIs to prevent crashes in browser environment
        await page.addInitScript(() => {
            (window as any).__TAURI__ = {
                invoke: async (cmd: string, args?: any) => {
                    console.log(`Mocked invoke: ${cmd}`, args);
                    if (cmd === 'check_for_updates') {
                        return { is_available: false, latest_version: '', release_url: '', release_date: '', body: '' };
                    }
                    if (cmd === 'get_project_manifest') {
                        return { name: args.name, collections: [], open_tabs: [], active_tab_id: null };
                    }
                    return {};
                },
                app: {
                    getVersion: async () => '0.1.10',
                    getTauriVersion: async () => '2.0.0',
                },
                event: {
                    listen: async () => () => {},
                }
            };
            // Mock permissions if needed
            (window as any).__TAURI_INTERNALS__ = {
                metadata: {
                    permissions: {
                        all: true
                    }
                }
            };
        });

        await page.goto('http://localhost:1420');
        
        // Wait for app to load (Welcome Screen)
        const welcomeHeading = page.locator('h1');
        await expect(welcomeHeading).toBeVisible();

        // Create a new project to enter the main UI
        const newProjectBtn = page.getByRole('button', { name: /New Project/i });
        await newProjectBtn.click();

        // Fill project name and confirm
        const promptInput = page.getByPlaceholder(/Enter value.../i);
        await promptInput.fill('Test Project');
        await page.keyboard.press('Enter');

        // Wait for main UI (Sidebar or Top Bar with Environment selector should be visible)
        // Check for "Env:" label
        const envLabel = page.getByText('Env:');
        await expect(envLabel).toBeVisible();
    });

    test('should inherit variables from Global in new environment', async ({ page }) => {
        // 1. Open Environment Manager
        const manageEnvBtn = page.getByTitle('Manage Environments');
        await manageEnvBtn.click();

        // 2. Add a variable to Global
        await expect(page.getByText('Global', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: /Add Variable/i }).click();
        
        const keyInputs = page.getByPlaceholder('Key');
        const valueInputs = page.getByPlaceholder('Value');
        await keyInputs.last().fill('global_var');
        await valueInputs.last().fill('global_val');

        // 3. Create a new environment
        await page.getByRole('button', { name: /New Env/i }).click();

        // 4. Verify inheritance visibility in the "Inherited from Global" section
        const inheritedSection = page.getByText(/Inherited from Global/i);
        await expect(inheritedSection).toBeVisible();
        await expect(page.getByText('global_var')).toBeVisible();

        // 5. Verify no override indicator initially for a new environment
        const overrideBadge = page.getByTitle(/Overrides Global variable/i);
        await expect(overrideBadge).not.toBeVisible();
    });

    test('should show override indicator only when global variable is overridden', async ({ page }) => {
        // 1. Open Environment Manager
        const manageEnvBtn = page.getByTitle('Manage Environments');
        await manageEnvBtn.click();

        // 2. Add global_key in Global
        await page.getByRole('button', { name: /Add Variable/i }).click();
        await page.getByPlaceholder('Key').last().fill('global_key');
        await page.getByPlaceholder('Value').last().fill('global_val');

        // 3. Create a new environment
        await page.getByRole('button', { name: /New Env/i }).click();

        // 4. Add a NEW local variable (not an override)
        await page.getByRole('button', { name: /Add Variable/i }).click();
        await page.getByPlaceholder('Key').last().fill('local_key');
        await page.getByPlaceholder('Value').last().fill('local_val');

        // Verify NO override badge for the local_key
        // We look for any element with the title "Overrides Global variable"
        const overrideBadge = page.getByTitle(/Overrides Global variable/i);
        await expect(overrideBadge).not.toBeVisible();

        // 5. Override the global variable
        // The global variable should be visible in the "Inherited from Global" section
        const overrideInput = page.getByPlaceholder(/Override Value/i);
        await overrideInput.fill('overridden_val');

        // 6. Verify "G" badge IS present for the override in the local list
        await expect(overrideBadge).toBeVisible();
        await expect(overrideBadge).toHaveText('G');

        // 7. Verify the local key is now shown as 'global_key' in the local list
        const localKeys = page.getByPlaceholder('Key');
        await expect(localKeys.first()).toHaveValue('global_key');
    });
});
