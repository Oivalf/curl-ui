# cURL-UI 🚀

**cURL-UI** is a modern, premium HTTP client built with **Tauri 2.0** and **Preact**. It provides a powerful desktop environment to organize, configure, and execute HTTP requests with a focus on speed, local privacy, and developer experience.

---

## ✨ Features

### 📂 Collection & Project Management
- **Hierarchical Organization**: Manage work using Projects, Collections, and Folders.
- **Interoperability**: Import **Swagger/OpenAPI** specs or **Postman collections**. Export any collection to Postman-compatible JSON.
- **Git Native**: Data is stored as human-readable JSON. Includes a built-in **Git Panel** with a **3-way Merge Editor** for resolving conflicts during collaboration.
- **Persistence**: All data remains local. Workspaces (open tabs, sidebar state, active project) are automatically persisted and restored.

### 🛠️ Request & Execution Workflow
- **Request Templates**: Define base structures (URL, Method, Headers, Auth, Scripts).
- **Execution Instances**: Create multiple independent runs for each request. Drag and drop to **Reorder Executions** in the sidebar.
- **Smart Overrides**: Override any template value for a specific run. Visual **Override Indicators** (blue dot) highlight every change.
- **Method Support**: Full support for GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS.
- **Advanced Body Editor**: High-performance editor for **JSON, YAML, XML, HTML, Form-data (with file picking),** and **Multipart**.

### 🔗 Inheritance & Variables
- **Dynamic Propagations**: Headers and Authentication can be inherited from parent folders or project levels.
- **Cookie Management**: Every project has an **Isolated Cookie Store**. Cookies are automatically captured and sent back to the same domain.
- **Environment Scoping**: Use **Global** or **Scoped** environments (Dev, Staging, Prod) with `{{variable_name}}` substitution.

### 📜 Scripting & Automation
- **JavaScript Engine**: Run custom logic before requests or after responses.
- **Real-time Progress**: Integrated **Execution Progress** panel with live timers.
- **Post-script Filtering**: Restrict script execution to specific HTTP status codes (e.g., `2xx, 401, 500`).
- **Debug Console**: Dedicated panel for `console.log` output from your scripts.

### 🎭 Mocking & Simulation
- **Collection Mocks**: Instantly mock any request defined in your collections.
- **External Mocks**: Run independent mock servers for 3rd party APIs on custom ports.
- **Priority Matching**: Routes are matched based on path specificity and query parameters.

---

## 📖 User Guide

A comprehensive documentation suite is available in `src-tauri/docs/user-guide` or via the in-app **Help > User Guide** menu.

- **[Introduction](src-tauri/docs/user-guide/index.md)**
- **[Request Editor](src-tauri/docs/user-guide/request-editor.md)**
- **[Execution Editor](src-tauri/docs/user-guide/execution-editor.md)**
- **[Git & Collaboration](src-tauri/docs/user-guide/collections.md#git-sync--conflict-resolution)**

---

## 🛠️ Technology Stack
- **Frontend**: Preact + TypeScript (@preact/signals for reactivity)
- **Editor**: CodeMirror 6
- **Backend**: Rust (via Tauri 2.0)
- **Styling**: Vanilla CSS (Premium Dark Theme)
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
