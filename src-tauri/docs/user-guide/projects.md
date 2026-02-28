# 📁 Projects

cURL-UI organizes work into projects. Each project is independent and contains its own collections, environments, and settings.

## Creating and Loading
- **New Project**: Create a new workspace from the Welcome Screen.
- **Switching**: Use the **File > Projects** menu to switch between existing projects.
- **Auto-load**: The application automatically loads the most recently used project on startup.

## Storage
Project data is stored locally:
- **Manifests**: Metadata is kept in the application config directory.
- **Collections**: Collection files can be stored anywhere on disk; projects track their locations via file paths.

## Cookies & Sessions
Each project maintains its own isolated **Cookie Store**. 
When a server responds with a `Set-Cookie` header, cURL-UI automatically saves the cookie and sends it back on subsequent requests to the same domain. Because cookie stores are isolated per-project, opening multiple projects simultaneously will not mix sessions or cause cookie leakage between them.
