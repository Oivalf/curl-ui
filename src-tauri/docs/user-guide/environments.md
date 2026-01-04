# Environments & Variables

Environments allow you to switch between different sets of variables (e.g., Local, Production) without changing your request definitions.

## The Environment Manager

Open the **Environment Manager** via the sidebar (Settings icon) or the header selector.

### 1. The Global Environment
The **Global** environment is special. It acts as a base layer for *all* other environments.
- Variables defined here are inherited by every request in your project.
- You cannot delete the Global environment.

### 2. Custom Environments
Create environments like "Prod" or "Test" to override Global values or add environment-specific keys.
- **Syncing Keys**: When you add or remove a variable key in one environment, cURL-UI automatically synchronizes that key across all your non-Global environments to keep them consistent.

## Variable Overrides

If a variable exists in the Global environment, you can **override** it in a specific environment:
- Select your environment (e.g., "Prod").
- You'll see Global variables listed.
- Edit the value to create a local override.
- An **[O]** or **Global** indicator will show if a value is local or inherited.

## Using Variables

Reference variables in URLs, Headers, or JSON Bodies using the double-curly brace syntax:
`{{variableName}}`

### Variable Resolution Order
1. **Local Request Variables**: (Not yet implemented, stay tuned!)
2. **Folder Variables**: Defined in the parent folder(s).
3. **Active Environment**: Values from your selected environment.
4. **Global Environment**: The final fallback for all requests.
