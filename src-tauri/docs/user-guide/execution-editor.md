# ⚡ Execution Editor

The Execution Editor is where you run requests and view responses. Each request can have multiple executions (instances).

## Features

- **Run/Send**: Execute the request with current settings.
- **Overrides**: You can customize headers, parameters, body, and auth for a specific execution. Overridden fields are marked with a yellow dot indicator.
- **Multi-Value Params**: Manage multiple values for query parameters using the `+` and `-` buttons.
- **Key-Level Control**: The "Enabled" checkbox for query parameters is located at the key level, allowing you to bulk-enable or disable all associated values.
- **Inheritance Protection**: Items (headers or parameters) inherited from a parent request are protected. You can toggle them off, but the delete (`×`) icon is hidden until you add a new override.
- **Response Panel**: View the status, timing, size, and body of the returned response.
- **Console**: Inspect logs from scripts executed during the request lifecycle.

## Override Indicators
A yellow dot next to an input field indicates that the value has been customized and is no longer following the parent Request template. Hover over the dot to see more details.

## State Management
Executions are reactive. If you haven't overridden a field, it will automatically update if you change the parent Request template. Once you customize a field, that link is broken for that specific value until you revert it to match the template.
