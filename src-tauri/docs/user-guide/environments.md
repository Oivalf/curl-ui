# 🌍 Environments

Environments allow you to switch between different sets of variables (e.g., Development, Production) without modifying requests.

## Global Environment
The **Global** environment defines variables available to all requests. It acts as the base layer for all other environments.

## Custom Environments
You can create custom environments to override Global values or add specific keys for a particular deployment.
- **Key Syncing**: Adding a key to one environment automatically adds it to all other custom environments to maintain consistency.

## Usage
Reference variables in URLs, Headers, or Bodies using: `{{variableName}}`.

## Variable Resolution Order
Variables are resolved in the following priority:
1. **Folder Variables**: Defined in the hierarchy of parent folders.
2. **Active Environment**: Values from the currently selected environment.
3. **Global Environment**: Final fallback.
