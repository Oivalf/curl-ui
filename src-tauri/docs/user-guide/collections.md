# 📦 Collections & Folders

cURL-UI uses a hierarchical structure to organize requests.

## Collections
A **Collection** is the top-level container, stored as a `.collection.json` file on disk.
- **Creation**: Create new collections or import existing `.collection.json` (or `.json`) files or **Swagger/OpenAPI** specifications using the sidebar.
- **Saving**: Changes are not auto-saved. Use **File > Save** to persist modifications.

## Folders
Folders group related requests and support variable inheritance.
- **Settings**: Use the Folder Editor to manage local variables, authentication, and headers.
- **Inheritance**: Variables and settings defined in a folder apply to all its contents.

## Sidebar
- **Navigation**: Click items to open their respective editors.
- **Organization**: Use chevrons to expand or collapse folders and requests.
- **Context Menu**: Right-click items to add, duplicate, or delete requests and folders.

## 🔄 Git Sync & Conflict Resolution

cURL-UI provides advanced Git integration for your collections:

- **Pulling Changes**: Use the **Pull** button in the Git Panel to fetch and merge changes from the remote repository.
- **Conflict Detection**: If a conflict occurs during a pull, the collection will be marked with a **RESOLVE CONFLICT** button.
- **3-way Merge Editor**: Click resolve to open a side-by-side editor. Compare your **LOCAL** version with the **REMOTE** one, edit the result, and click **Mark as Resolved** to finish the merge.
- **Commit & Push**: Once conflicts are resolved (or if there are only local changes), provide a commit message and click the **Commit & Push** icon to synchronize with the server.
