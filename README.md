# curl-ui 🚀

**curl-ui** is a modern, premium, and powerful API client built with **Tauri** and **Preact**. It's designed to provide a sleek and efficient developer experience for testing, organizing, and executing HTTP requests with the speed of rust and the flexibility of a modern UI.

---

## ✨ Features

### 📂 Collection & Project Management
- **Hierarchical Organization**: Organize your requests into **Collections** and **Folders**.
- **Persistence**: Collections are saved directly to your disk in a clean JSON format (e.g., `my-api.json`).
- **Sidebar Integration**: Easily create, rename, and delete collections and folders with right-click context menus.
- **Save Everywhere**: Use `Ctrl+S` (Save) or `Ctrl+Shift+S` (**Save All**) to keep your work synchronized. Native File menu support included.

### 🛠️ Professional Request Editor
- **Full Method Support**: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS.
- **Dynamic URL Handling**: Supports query parameters and path variables with a dedicated editor.
- **Versatile Body Editor**:
    - **JSON/XML**: Syntax-aware raw editing.
    - **Form Data**: dedicated UI for key-value pairs.
    - **Multipart**: Support for binary file uploads.
- **Header Management**: Custom headers with easy-to-use key-value inputs.
- **Advanced Auth**: Support for **Basic Auth**, **Bearer Tokens**, and powerful **Inheritance** models.

### 🔗 Smart Inheritance System
- **Propagate Settings**: Define Auth and Headers at the Folder or Collection level and let child requests inherit them automatically.
- **Visual Source Tracking**: The UI clearly shows where an inherited setting comes from (e.g., "Inherited from Folder: Users").
- **Direct Navigation**: Click on an inherited source to instantly navigate to the folder where it's defined.

### 📜 Scripting & Automation
- **Pre-scripts**: Execute Javascript code before sending a request. Set variables or prepare data dynamically.
- **Post-scripts**: Process responses automatically.
    - **Status Filtering**: Run specific scripts only on certain outcomes (e.g., `200`, `2xx`, `401`).
    - **Response Access**: Access the full `response` object in your scripts.
- **Scripting API**: Use `env.get()` and `env.set()` to interact with your environment variables.
- **Integrated Console**: A specialized log panel in the footer to debug your scripts with `console.log`.

### 🌍 Powerful Environment Management
- **Scoped Variables**: Switch between **Local**, **Dev**, **Test**, and **Prod** environments with a single click in the header.
- **Global Fallback**: A special "Global" environment for variables that should always be available as a final fallback.
- **Variable Synchronization**: Keep your environments aligned. Renaming a key in one environment automatically updates all others (excluding Global).
- **Intelligent Overrides**:
    - View "Inherited from Global" variables directly while editing any environment.
    - Override a Global value for a specific environment by simply editing it.
    - **Override Indicators**: Visual "G" badges mark variables that are currently overriding a Global value.
- **Variable Substitution**: Use `{{variable_name}}` syntax anywhere in your URL, Headers, or Body for automatic replacement.

---

## 🎨 Design Aesthetics
- **Premium UI**: Vibrant colors, dark mode, glassmorphism, and dynamic micro-animations.
- **Cross-Platform**: Built with Tauri for a lightweight, native experience on Linux, macOS, and Windows.
- **Safe Workflows**: Integrated confirmation modals for destructive actions (e.g., deletes), with intelligent layering to ensure they always appear on top.

## 📖 User Guide

Explore the detailed documentation to master Curl UI:

- **[Introduction & Overview](src-tauri/docs/user-guide/index.md)**

---

## 🛠️ Technology Stack
- **Frontend**: Preact + TypeScript
- **State Management**: @preact/signals (for high-performance reactivity)
- **Styling**: Vanilla CSS (Modern CSS variables and Flex/Grid)
- **Icons**: Lucide-Preact
- **Backend**: Rust (via Tauri 2.0)
- **Build Tool**: Vite

---

## 🚀 Getting Started

1. **Prerequisites**: Ensure you have the [Rust toolchain](https://rustup.rs/) installed.
2. **Setup**:
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

Made with ❤️ by the **curl-ui** team.
