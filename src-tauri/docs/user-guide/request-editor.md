# 📝 Request Editor

The Request Editor is used to define the base configuration (template) for an HTTP request. 

## Template Configuration

- **Name**: The descriptive name of the request.
- **Method**: The HTTP verb (GET, POST, etc.) that will be used.
- **URL**: The endpoint path. Support for `{{variables}}`.
- **Headers**: Define key-value pairs for HTTP headers. Multiple headers with the same key (e.g., multiple `Accept` headers) are supported.
- **Auth**: Configure authentication (Inherit, Basic, or Bearer).
- **Body**: Define the default payload structure (JSON, Form-data, Text, etc.). The selected body type and its content (including form-data fields) are automatically persisted.
- **Scripts**: Configure JavaScript logic to run before or after executions.

> [!TIP]
> Use `{{` in any URL, Parameter, Header, or Body field to trigger **Variable Autocomplete**. It will show all accessible variables and their sources.

## Inheritance
Requests can inherit authentication and headers from their parent folders. This ensures consistency across entire segments of your API.

## Relationship with Executions
The Request Editor defines the structure. To actually send the request, you use an **Execution**. Modifications made to the Request Editor will automatically propagate to all child Executions that haven't overridden those specific fields.
