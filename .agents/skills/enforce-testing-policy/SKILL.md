---
name: enforce-testing-policy
description: Ensures that for every modification, both a unit test and an E2E test are created or updated.
---

# Enforce Testing Policy

## When to Run

This skill MUST be executed **every time a code modification is made** to the project (logic, components, or UI). It ensures the project remains stable and regressions are prevented.

## Instructions

### 1. Identify the Scope of Changes

Before finalizing your task, determine if your changes affect logic (store, utils) or UI (components, layout).

### 2. Create Unit/Integration Tests (Vitest)

For any change in business logic, state management (`src/store`), or utility functions (`src/utils`):
- Create a new test file in `tests/` or update an existing one.
- Use **Vitest** for testing signals and logic.
- Verify core functionality and edge cases.
- **Path**: `tests/**/*.test.ts`

### 3. Create E2E Tests (Playwright)

For any UI interaction change, new component, or visual update:
- Create a new test file in `e2e/` or update an existing one.
- Use **Playwright** to verify cross-component interactions and user flows.
- Ensure buttons, inputs, and modals work as expected.
- **Path**: `e2e/**/*.spec.ts`

### 4. Verify Tests

- Run logic tests: `npm test tests/your_file.test.ts`
- Run E2E tests: `npx playwright test e2e/your_file.spec.ts`
- Ensure all tests pass before completing the conversation.

### 5. Document the Tests

In your final walkthrough, explicitly mention which tests were added or updated to cover the changes.

## Best Practices

- **Atomic Tests**: Each test should focus on one specific behavior.
- **Clean State**: Always reset the store/UI state in `beforeEach` to ensure test isolation.
- **I18N Compatibility**: Use translation keys (`t()`) or robust selectors (like `getByRole`) to ensure tests work across different languages if needed.
