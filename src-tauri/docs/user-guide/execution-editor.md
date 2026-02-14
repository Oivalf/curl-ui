# ⚡ Execution Editor

The Execution Editor is where you run requests and view responses. Each request can have multiple executions (instances).

## Features

- **Run & Cancel**: Execute the request with current settings. While a request is running, the **Run** button transforms into a **Cancel** button, allowing you to stop the request immediately.
- **Overrides**: You can customize headers, parameters, body, and auth for a specific execution. Overridden fields are marked with a yellow dot indicator.
- **Execution Progress**: A real-time summary panel appears during execution, showing detailed steps (Pre-scripts, preparation, HTTP request, and post-scripts) with their individual durations.
- **Status & Size**: View formatted response size (e.g., KB, MB) and status codes in both the progress summary and the response panel.
- **Color Coding**: HTTP status codes are color-coded for quick identification: 🟢 Green for 2xx (Success), 🔴 Red for 4xx/5xx (Errors), and 🟡 Yellow for other codes.
- **Multi-Value Params**: Manage multiple values for query parameters using the `+` and `-` buttons.
- **Key-Level Control**: The "Enabled" checkbox for query parameters is located at the key level, allowing you to bulk-enable or disable all associated values.
- **Inheritance Protection**: Items (headers or parameters) inherited from a parent request are protected. You can toggle them off, but the delete (`×`) icon is hidden until you add a new override.
- **Response Panel**: View the detailed headers and body of the returned response.
- **Console**: Inspect logs from scripts and application information in the integrated Console Panel.

## Progress Summary
The progress summary provides transparency into the request lifecycle:
- **Total Time**: The overall duration from initiating the run to the completion of all steps.
- **Response Time**: The specific duration of the HTTP network request.
- **Step Durations**: Individual timings for each phase of the execution.

## Override Indicators
A yellow dot next to an input field indicates that the value has been customized and is no longer following the parent Request template. Hover over the dot to see more details.

## State Management
Executions are reactive. If you haven't overridden a field, it will automatically update if you change the parent Request template. Once you customize a field, that link is broken for that specific value until you revert it to match the template.
