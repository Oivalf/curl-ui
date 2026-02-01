# cURL-UI 🚀

**cURL-UI** is an HTTP client built with **Tauri** and **Preact**. It provides a desktop interface to organize, configure, and execute HTTP requests.

---

## ✨ Features

### 📂 Collection & Project Management
- **Organization**: Hierarchical structure with Collections and Folders.
- **Persistence**: All data is stored locally on your machine as human-readable JSON files.
- **Git Friendly**: The clean JSON format makes it easy to track changes, collaborate, and sync your collections using **Git** or any version control system.
- **Sidebar**: Context menus for creating, renaming, and deleting items.
- **Shortcuts**: `Ctrl+S` (Save) and `Ctrl+Shift+S` (Save All) to persist changes.

### 🛠️ Request & Execution Workflow
- **Request Templates**: Define the base structure for your endpoints (URL, Method, Headers, Auth, Scripts).
- **Executions**: Run specific instances of a request. Supports overriding template values.
- **Override Indicators**: Visual indicators (yellow dot) show when an execution value differs from the template.
- **Method Support**: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS.
- **Body Editor**: Support for JSON, Form-data, Multipart, and plain text.

### 🔗 Inheritance
- **Automatic Propagation**: Headers and Authentication can be defined at the folder level and inherited by child requests.
- **Tracking**: The UI identifies the source of inherited settings and allows jumping to the source folder.

### 📜 Scripting & Automation
- **JavaScript Engine**: Run custom logic before sending a request or after receiving a response.
- **Environment Access**: Use `env.get()` and `env.set()` to manage variables dynamically.
- **Post-script Filtering**: Execution of scripts can be restricted to specific HTTP status codes.
- **Console**: Log panel for script debugging via standard `console` methods.
### 🎭 Mocking & Simulation
- **Collection Mocks**: Simulate responses for requests defined within your collections.
- **External Mocks**: Create independent mock servers for 3rd party APIs not defined in your collections.
- **Port Control**: Run multiple mock servers simultaneously on different ports.
- **Smart Matching**: Priority-based matching for paths and query parameters.

### 🌍 Environments
- **Scoped Variables**: Manage sets of variables for different environments (e.g., Development, Production).
- **Global Variables**: Base variables available across all environments.
- **Key Synchronization**: Keys are synced across non-global environments to maintain consistent structures.
- **Substitution**: Use `{{variable_name}}` syntax in URLs, Headers, and Bodies.

---

## 📖 User Guide

Documentation is available in the `src-tauri/docs/user-guide` directory or via the in-app help panel.

- **[Introduction](src-tauri/docs/user-guide/index.md)**
- **[Request Editor](src-tauri/docs/user-guide/request-editor.md)**
- **[Execution Editor](src-tauri/docs/user-guide/execution-editor.md)**

---

## 🛠️ Technology Stack
- **Frontend**: Preact + TypeScript
- **Reactivity**: @preact/signals
- **Styling**: Vanilla CSS
- **Icons**: Lucide-Preact
- **Backend**: Rust (via Tauri 2.0)
- **Build Tool**: Vite

---

## 🚀 Getting Started

1. **Prerequisites**: [Rust toolchain](https://rustup.rs/) and [Node.js](https://nodejs.org/).
2. **Installation**:
   ```bash
   npm install
   ```
3. **Development**:
   ```bash
   npm run tauri dev
   ```
4. **Build**:
   ```bash
   npm run tauri build
   ```

---

## 📄 License

Made with ❤️ by the **cURL-UI** team.
