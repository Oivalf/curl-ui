# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: variables.spec.ts >> Variable Inheritance UI >> should show override indicator only when global variable is overridden
- Location: e2e/variables.spec.ts:84:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Env:')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Env:')

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Variable Inheritance UI', () => {
  4   |     test.beforeEach(async ({ page }) => {
  5   |         // Mock Tauri APIs to prevent crashes in browser environment
  6   |         await page.addInitScript(() => {
  7   |             (window as any).__TAURI__ = {
  8   |                 invoke: async (cmd: string, args?: any) => {
  9   |                     console.log(`Mocked invoke: ${cmd}`, args);
  10  |                     if (cmd === 'check_for_updates') {
  11  |                         return { is_available: false, latest_version: '', release_url: '', release_date: '', body: '' };
  12  |                     }
  13  |                     if (cmd === 'get_project_manifest') {
  14  |                         return { name: args.name, collections: [], open_tabs: [], active_tab_id: null };
  15  |                     }
  16  |                     return {};
  17  |                 },
  18  |                 app: {
  19  |                     getVersion: async () => '0.1.10',
  20  |                     getTauriVersion: async () => '2.0.0',
  21  |                 },
  22  |                 event: {
  23  |                     listen: async () => () => {},
  24  |                 }
  25  |             };
  26  |             // Mock permissions if needed
  27  |             (window as any).__TAURI_INTERNALS__ = {
  28  |                 metadata: {
  29  |                     permissions: {
  30  |                         all: true
  31  |                     }
  32  |                 }
  33  |             };
  34  |         });
  35  | 
  36  |         await page.goto('http://localhost:1420');
  37  |         
  38  |         // Wait for app to load (Welcome Screen)
  39  |         const welcomeHeading = page.locator('h1');
  40  |         await expect(welcomeHeading).toBeVisible();
  41  | 
  42  |         // Create a new project to enter the main UI
  43  |         const newProjectBtn = page.getByRole('button', { name: /New Project/i });
  44  |         await newProjectBtn.click();
  45  | 
  46  |         // Fill project name and confirm
  47  |         const promptInput = page.getByPlaceholder(/Enter value.../i);
  48  |         await promptInput.fill('Test Project');
  49  |         await page.keyboard.press('Enter');
  50  | 
  51  |         // Wait for main UI (Sidebar or Top Bar with Environment selector should be visible)
  52  |         // Check for "Env:" label
  53  |         const envLabel = page.getByText('Env:');
> 54  |         await expect(envLabel).toBeVisible();
      |                                ^ Error: expect(locator).toBeVisible() failed
  55  |     });
  56  | 
  57  |     test('should inherit variables from Global in new environment', async ({ page }) => {
  58  |         // 1. Open Environment Manager
  59  |         const manageEnvBtn = page.getByTitle('Manage Environments');
  60  |         await manageEnvBtn.click();
  61  | 
  62  |         // 2. Add a variable to Global
  63  |         await expect(page.getByText('Global', { exact: true })).toBeVisible();
  64  |         await page.getByRole('button', { name: /Add Variable/i }).click();
  65  |         
  66  |         const keyInputs = page.getByPlaceholder('Key');
  67  |         const valueInputs = page.getByPlaceholder('Value');
  68  |         await keyInputs.last().fill('global_var');
  69  |         await valueInputs.last().fill('global_val');
  70  | 
  71  |         // 3. Create a new environment
  72  |         await page.getByRole('button', { name: /New Env/i }).click();
  73  | 
  74  |         // 4. Verify inheritance visibility in the "Inherited from Global" section
  75  |         const inheritedSection = page.getByText(/Inherited from Global/i);
  76  |         await expect(inheritedSection).toBeVisible();
  77  |         await expect(page.getByText('global_var')).toBeVisible();
  78  | 
  79  |         // 5. Verify no override indicator initially for a new environment
  80  |         const overrideBadge = page.getByTitle(/Overrides Global variable/i);
  81  |         await expect(overrideBadge).not.toBeVisible();
  82  |     });
  83  | 
  84  |     test('should show override indicator only when global variable is overridden', async ({ page }) => {
  85  |         // 1. Open Environment Manager
  86  |         const manageEnvBtn = page.getByTitle('Manage Environments');
  87  |         await manageEnvBtn.click();
  88  | 
  89  |         // 2. Add global_key in Global
  90  |         await page.getByRole('button', { name: /Add Variable/i }).click();
  91  |         await page.getByPlaceholder('Key').last().fill('global_key');
  92  |         await page.getByPlaceholder('Value').last().fill('global_val');
  93  | 
  94  |         // 3. Create a new environment
  95  |         await page.getByRole('button', { name: /New Env/i }).click();
  96  | 
  97  |         // 4. Add a NEW local variable (not an override)
  98  |         await page.getByRole('button', { name: /Add Variable/i }).click();
  99  |         await page.getByPlaceholder('Key').last().fill('local_key');
  100 |         await page.getByPlaceholder('Value').last().fill('local_val');
  101 | 
  102 |         // Verify NO override badge for the local_key
  103 |         // We look for any element with the title "Overrides Global variable"
  104 |         const overrideBadge = page.getByTitle(/Overrides Global variable/i);
  105 |         await expect(overrideBadge).not.toBeVisible();
  106 | 
  107 |         // 5. Override the global variable
  108 |         // The global variable should be visible in the "Inherited from Global" section
  109 |         const overrideInput = page.getByPlaceholder(/Override Value/i);
  110 |         await overrideInput.fill('overridden_val');
  111 | 
  112 |         // 6. Verify "G" badge IS present for the override in the local list
  113 |         await expect(overrideBadge).toBeVisible();
  114 |         await expect(overrideBadge).toHaveText('G');
  115 | 
  116 |         // 7. Verify the local key is now shown as 'global_key' in the local list
  117 |         const localKeys = page.getByPlaceholder('Key');
  118 |         await expect(localKeys.first()).toHaveValue('global_key');
  119 |     });
  120 | });
  121 | 
```