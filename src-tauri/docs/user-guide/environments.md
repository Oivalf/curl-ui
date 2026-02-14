# 🌍 Environments

Environments allow you to switch between different sets of variables (e.g., Development, Production) without modifying requests.

## Global Environment
The **Global** environment defines variables available to all requests. It acts as the base layer for all other environments.

## Custom Environments
You can create custom environments to override Global values or add specific keys for a particular deployment.
- **Key Syncing**: Adding a key to one environment automatically adds it to all other custom environments to maintain consistency.

## Usage
Reference variables in URLs, Headers, Parameters, or Bodies using the double curly brace syntax: `{{variableName}}`.

### Autocomplete
When you type `{{`, a floating suggestions list will appear. This list contains all variables accessible from the current context, including Global, active environment, and parent folder variables.

### Variable Source
The autocomplete suggestions also show the origin of each variable:
- **Global**: A global variable.
- **Env: [Name]**: From the specified environment.
- **Folder: [Name]**: From a parent folder.

This helps you quickly identify where a variable is defined and ensure you are using the correct one.

## Variable Resolution Order
Variables are resolved dynamically based on the current context following this priority:
1. **Folder Variables**: Defined in the hierarchy of parent folders (closest parents first).
2. **Active Environment**: Values from the currently selected custom environment.
3. **Global Environment**: The final fallback for all variables.
