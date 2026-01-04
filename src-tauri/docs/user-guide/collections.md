# Collections & Folders

Organization is key to efficient API testing. cURL-UI provides a hierarchical structure to manage your requests.

## Collections

A **Collection** is the top-level container for your requests. In cURL-UI, collections are stored as JSON files on your disk.

- **Creating a Collection**: Click the **New** button in the sidebar. You'll be prompted for a name.
- **Importing**: You can load existing JSON collections from your disk.
- **Persistence**: Changes to collections are NOT saved automatically. Use **File > Save** (Cmd/Ctrl + S) or **Save All** to persist your changes to disk.

## Folders

Folders allow you to group related requests within a collection.

- **Inheritance**: Folders are more than just containers; they support **Variable Inheritance**. Variables defined at the folder level are automatically available to all requests and subfolders inside them.
- **Folder Settings**: Click on a folder in the sidebar to open the Folder Editor. Here you can manage:
    - **Variables**: Local variables for the folder.
    - **Inherited Variables**: A read-only view of variables inherited from parent folders or the Global environment.

## Sidebar Controls

The sidebar is your main navigation hub:
- **Expand/Collapse**: Click the arrows next to collections and folders.
- **Selection**: Clicking an item opens its dedicated editor in the main panel.
- **Context Actions**: Right-click (or similar UI buttons) to add new requests or folders.
