# 📝 Request Editor

The Request Editor is used to define the base configuration (template) for an HTTP request. 

## Template Configuration

- **Name**: The descriptive name of the request.
- **Method**: The HTTP verb (GET, POST, etc.) that will be used.
- **URL**: The endpoint path. Support for `{{variables}}`.
- **Headers**: Define key-value pairs for HTTP headers. Multiple values for the same key are supported by grouping them under a single key input with `+` and `-` buttons.
- **Auth**: Configure authentication (Inherit, Basic, or Bearer).
- **Body**: Define the default payload structure (JSON, Form-data, Text, etc.). The selected body type and its content (including form-data fields) are automatically persisted.
- **Integrated Results Panel**: When running a request via **Run Default**, the results (status, response body, headers) are displayed directly in a side-by-side panel within the Request Editor. This allows for rapid iteration between editing the request and viewing results.
- **Persistence**: The visibility of the results panel is preserved on a per-request basis. If you close the panel or switch tabs, its state will be restored when you return.

## 💻 Advanced Code Editor

The editor (powered by CodeMirror 6) provides several productivity features for Request Body and Scripts:

- **Syntax Highlighting**: Support for JSON, YAML, HTML, XML, and JavaScript.
- **Quick Run**: Use the **Run Default** button in the header (Play icon) to instantly trigger the default execution. The view will automatically split to show the execution progress and the result panel.
- **Intelligent Autocomplete**: 
    - Type `{{` to trigger **Variable Autocomplete**. It shows accessible variables from environments and parent folders.
    - Inside JavaScript scripts, get suggestions for `request`, `response`, and `env` objects.
- **Auto-Formatting**: Use the **Format** button to automatically clean up your JSON, JavaScript, or XML code using Prettier.

> [!TIP]
> Use `{{` in any URL, Parameter, Header, or Body field to trigger **Variable Autocomplete**. It will show all accessible variables and their sources.

## Inheritance
Requests can inherit authentication and headers from their parent folders. This ensures consistency across entire segments of your API.

## Relationship with Executions
Every request has a **Default Execution** that is automatically created and maintained. Modifications made to the Request Editor propagate to this execution. For more complex scenarios, you can create multiple named executions to test different scenarios (e.g. "Happy Path", "Validation Error").
