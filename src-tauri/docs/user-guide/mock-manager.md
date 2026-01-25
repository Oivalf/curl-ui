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

## 📍 Path Matching

The mock server matches incoming requests by **Method** and **Path**. 
- If your request URL is `https://api.example.com/v1/users`, the mock server will match `/v1/users`.
- If the URL is just a path like `/health`, it will match `/health`.

## 🟢 Status Tracking

When a mock server is active, a green dot appears next to the **Mock Manager** node in the sidebar, providing instant confirmation that the endpoints are live.

---
© 2026 Oivalf
