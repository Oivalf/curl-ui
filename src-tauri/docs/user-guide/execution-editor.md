# ⚡ Execution Editor

The Execution Editor is where you run requests and view responses. Each request can have multiple executions (instances).

## Features

- **Default Execution**: Every request starts with a single "Default" execution that cannot be renamed or deleted, ensuring you always have a clean baseline for runs.
- **Run & Cancel**: Execute the request with current settings. While a request is running, the **Run** button transforms into a **Cancel** button, allowing you to stop the request immediately.
- **Overrides**: You can customize headers, parameters, body, and auth for a specific execution. Overridden fields are marked with a yellow dot indicator.
- **Execution Progress**: A real-time summary panel appears during execution, showing detailed steps (Pre-scripts, preparation, HTTP request, and post-scripts).
- **Live Timer**: While a step is running, a live ticking timer shows the elapsed time in milliseconds, using a dot (`.`) as the thousands separator for better readability.
- **Status & Size**: View formatted response size (e.g., KB, MB) and status codes in both the progress summary and the response panel.
- **Color Coding**: HTTP status codes are color-coded for quick identification: 🟢 Green for 2xx (Success), 🔴 Red for 4xx/5xx (Errors), and 🟡 Yellow for other codes.
- **Multi-Value Support**: Manage multiple values with the same key for both query parameters and HTTP headers using the `+` and `-` buttons. This allows sending duplicate headers like `Set-Cookie` or `Accept` without overriding each other.
- **Key-Level Control**: The "Enabled" checkbox for query parameters and headers is located at the key level, allowing you to bulk-enable or disable all associated values.
- **Cookie Management**: Each project maintains its own isolated cookie store. When a request returns a `Set-Cookie` header, subsequent requests to the same domain within that project will automatically include the stored cookies.
- **Body & Form-Data Persistence**: The selected payload type (e.g., Multipart, Form Urlencoded) and all its defined fields (`formData`) are safely preserved during execution state changes.
- **Inheritance Protection**: Items (headers or parameters) inherited from a parent request are protected. You can toggle them off, but the delete (`×`) icon is hidden until you add a new override.
- **Response Panel**: View the detailed headers and body of the returned response. Responses are **isolated and persisted per execution**, meaning you can run multiple requests and switch between their tabs without losing or sharing response data.
- **Console**: Inspect logs from scripts and application information in the integrated Console Panel.

## Progress Summary
The progress summary provides transparency into the request lifecycle:
- **Total Time**: The overall duration from initiating the run to the completion of all steps.
- **Step Durations**: Individual timings for each phase of the execution, which update in real-time while a step is active. All durations are formatted with Italian localization (e.g., `1.234ms`).

## Override Indicators
A yellow dot next to an input field indicates that the value has been customized and is no longer following the parent Request template. Hover over the dot to see more details.

## State Management
Executions are reactive. If you haven't overridden a field, it will automatically update if you change the parent Request template. Once you customize a field, that link is broken for that specific value until you revert it to match the template.
