# 📂 Folder Editor

Folders are used to group requests and share configurations across multiple endpoints.

## Configuration

- **Name**: The folder name.
- **Variables**: Define key-value pairs that can be used via `{{variableName}}` in all child requests and executions.
- **Auth**: Set a default authentication method that child requests can inherit.
- **Headers**: Define default headers that will be automatically added to all child requests.

## Hierarchical Inheritance
Inheritance works recursively. A folder can inherit from its parent folder, and so on, up to the collection level. This allows you to define base headers (like `Accept: application/json`) once at the top level.
