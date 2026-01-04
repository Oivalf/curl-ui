# Project Management

cURL-UI uses a project-based approach to keep your workspaces organized. Each project is independent, with its own set of collections, environments, and settings.

## The Welcome Screen

If you launch cURL-UI and no projects are found in your configuration directory (`~/.curl-ui`), you'll be greeted by the **Welcome Screen**.

- **Create New Project**: Click this button to start a fresh workspace.
- **Onboarding Info**: The Welcome Screen also displays current application versions and license info.

## Switching Projects

You can have multiple projects stored on your system. To switch between them:

1. Go to the **File** menu in the native menu bar.
2. Navigate to the **Recent Projects** submenu.
3. Select the project you wish to load.

> [!NOTE]
> Switching projects will clear the current sidebar and load the collections associated with the selected project.

## Project Storage

All your project data is stored locally on your machine:

- **Manifests**: Project metadata is stored in `~/.curl-ui/*.json`.
- **Collections**: The actual collection files can be located anywhere on your disk, but the project manifest keeps track of their paths.

## Auto-Load

cURL-UI is smart! When you start the application, it automatically identifies and loads the **most recently modified project**, so you can pick up exactly where you left off.
