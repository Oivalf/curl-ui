# 🎭 Mock Manager

The **Mock Manager** allows you to create local HTTP servers that simulate API responses based on the requests defined in a collection. This is useful for backend-independent development and testing.

## 🚀 Getting Started

1.  **Open the Manager**: Right-click any collection in the sidebar and select **Mock Manager**, or click the **Mock Manager** node fixed at the top of the collection.
2.  **Configure the Server**:
    - **Port**: Set the local port for the server (default: 3000).
    - **Start/Stop**: Use the primary button to toggle the server state.
3.  **Define Mock Responses**:
    - Select a request from the list and toggle the checkbox to enable it for mocking.
    - Expand the request to configure the simulated **Status Code**, **Headers**, and **Response Body**.

## 🌐 External Mocks

**External Mocks** are independent of your collections. They allow you to simulate 3rd party services or external APIs that you don't necessarily want to define as requests in your project.

1.  **Create an External Mock**: Click the **+** (Plus) button in the **External Mocks** section of the sidebar.
2.  **Load from Disk**: Click the **Load** (Folder) button in the same section to select an existing mock JSON file. This allows you to import configurations shared by other teammates or from previous projects.
3.  **Autonomous Management**: Each External Mock has its own configuration for Port and endpoints.
4.  **Persistence**: They are saved as individual JSON files and referenced in the project manifest.

## 📍 Path & Query Matching

The mock server uses a priority-based matching system:

1.  **Exact Match (Path + Query)**: If you define a mock path with query parameters (e.g., `/api/check?id=123`), the server will first try to match the full URI exactly.
2.  **Generic Match (Path Only)**: If no exact match is found, the server fallbacks to matching only the path (Method + Path), provided the mock definition itself doesn't contain a query string.

This allows you to create specific responses for specific query combinations while having a "catch-all" response for the base path.

## 🟢 Status Tracking

When a mock server is active (Collection or External), a green dot appears next to its name in the sidebar.

---
© 2026 Oivalf
