# 📝 Request Editor

The Request Editor is used to define the base configuration (template) for an HTTP request. 

## Template Configuration

- **Name**: The descriptive name of the request.
- **Method**: The HTTP verb (GET, POST, etc.) that will be used.
- **URL**: The endpoint path. Support for `{{variables}}`.
- **Headers**: Define key-value pairs for HTTP headers. Multiple values for the same key are supported by grouping them under a single key input with `+` and `-` buttons.
- **Auth**: Configure authentication (Inherit, Basic, or Bearer).
- **Body**: Define the default payload structure (JSON, Form-data, Text, etc.). The selected body type and its content (including form-data fields) are automatically persisted.
- **Scripts**: Configure JavaScript logic to run before or after executions.

## 💻 Advanced Code Editor

The editor (powered by CodeMirror 6) provides several productivity features for Request Body and Scripts:

- **Syntax Highlighting**: Support for JSON, YAML, HTML, XML, and JavaScript.
- **Intelligent Autocomplete**: 
    - Type `{{` to trigger **Variable Autocomplete**. It shows accessible variables from environments and parent folders.
    - Inside JavaScript scripts, get suggestions for `request`, `response`, and `env` objects.
- **Auto-Formatting**: Use the **Format** button to automatically clean up your JSON, JavaScript, or XML code using Prettier.

> [!TIP]
> Use `{{` in any URL, Parameter, Header, or Body field to trigger **Variable Autocomplete**. It will show all accessible variables and their sources.

## Inheritance
Requests can inherit authentication and headers from their parent folders. This ensures consistency across entire segments of your API.

## Relationship with Executions
The Request Editor defines the structure. To actually send the request, you use an **Execution**. Modifications made to the Request Editor will automatically propagate to all child Executions that haven't overridden those specific fields.
