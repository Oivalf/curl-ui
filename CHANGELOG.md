# Changelog

All notable changes to cURL-UI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 0.1.9

### Added
- 

### Fixed
- 

### Changed
- **Use Cases**: Blackboard persistence refined. Only variables manually defined in the UI are persisted in the project manifest. Variables set via scripts or step responses remain completely volatile and are lost upon restart.

---

## [0.1.8] - 2026-04-04 

### Added
- **TabBar**: Tabs now dynamically expand their width on hover to show the full name when truncated
- **TabBar**: Continuous scroll arrows (left/right) appear when tabs overflow the available space, and automatic scroll into view when selecting items from the sidebar (or activating tabs)
- **Use Cases**: Full request and response visibility for each execution step during and after execution
- **Use Cases**: Added a persistent **Blackboard** to each Use Case for sharing and capturing variables between execution steps
- **Use Cases**: JavaScript scripting support for each step with access to `blackboard`, `request`, and `response` objects
- **Use Cases**: Step responses are automatically saved to the blackboard as `step_N_response`

### Fixed
- **Windows**: Drag & drop not working due to WebView2 intercepting HTML5 DragEvent (disabled native file drop handler)
- **macOS**: Application freeze when using custom title bar with transparent window (enabled macOS Private API)
- **Path Params**: Fixed bug where `{param}` placeholders in the URL were permanently replaced with their values in the store upon execution
- **Use Cases**: Fixed bugs causing Use Case requests to ignore path parameters, query parameters, authentication settings, and form data from their respective execution overrides
- **Use Cases**: Use Case steps now run in ephemeral mode, preserving the original Execution's response data in the UI
- **Path Params**: Fixed bug where path parameters were lost when switching between tabs
- **Project Loading**: Fixed bug where execution state from previous projects was not cleared on project switch
- **Swagger Import**: Request body was incorrectly populated with the response body example instead of the request body
- **Swagger Import**: Content-Type header was hardcoded to `application/json` instead of using the actual type from the spec
- **cURL Import**: Unknown flags with value arguments (e.g. `--connect-timeout 30`) could cause the value to be misinterpreted as the URL
- **Postman Import**: Crash when importing collections with `formdata` or `urlencoded` body mode but missing array data

### Changed
- **Use Cases**: Execution dropdowns are now grouped by Request and sorted (Default first) for significantly better navigation and clarity
- **Use Cases**: Refactored execution full path logic to be cleaner and more descriptive inside the grouped selection list
- **Use Cases**: Blackboard is now transient (memory-only) and no longer persisted to disk to avoid bloating project files
- **Use Cases**: Replaced extraction rules with a full JavaScript script editor powered by CodeMirror
- **Use Cases**: Step scripts are injected as additional pre-scripts and can modify the request before it is sent

---

## [0.1.7] - 2026-03-15

### Added
- **Custom Title Bar**: Replaced system title bar with a custom one featuring burger menu, window controls, and project name display
- **Drag & Drop Reordering**: Full drag & drop support for tabs, requests, folders, and executions in the sidebar
- **Execution Duplication**: Ability to duplicate executions
- **Postman Import/Export**: Support for importing and exporting Postman collections
- **Multipart Content-Type**: Automatic detection and specification of `Content-Type` for files in `multipart/form-data` requests
- **User Guide**: Updated and expanded user guide documentation
- **Sub-tab Memory**: Application remembers the last selected sub-tab within editors

### Fixed
- Code editor horizontal scrollbar and overflow issues
- Content tab loading on startup
- Progress bar resizing and response sub-tab scrollbars
- New projects popup duplication
- Build warnings and errors

### Changed
- Default execution is now unchangeable and cannot be moved via drag & drop
- Execution name and reference displayed on the same line
- Updated README

---

## [0.1.6] - 2026-03-01

### Added
- **Execution System Refactoring**: Major rework of the execution architecture with dedicated `ExecutionEditor`
- **Default Execution**: Automatic creation and management of a default execution per request
- **Side-by-Side View**: Default execution displayed side-by-side within the request editor
- **Execution Progress**: Compact view for execution progress indicators
- **Tab Bar Context Menu**: Right-click context menu on tabs with additional actions
- **Session Persistence**: Save and restore session status (open tabs, active selections)
- **User Guide**: Comprehensive user guide documentation

### Fixed
- Code editor scrolling issues
- Raw response and cURL panel preview
- Build issues
- Various presentation and naming fixes

### Changed
- Complete sidebar refactoring with `BaseSidebarItem` component
- Response panel refactoring for better modularity

---

## [0.1.5] - 2026-02-15

### Added
- **Use Cases**: Introduction of Use Case workflows for chaining multiple requests
- **Variable Suggestions**: Autocomplete suggestions for variables in the code editor
- **Body Response Saving**: Ability to save response bodies to disk
- **User Guide**: Initial user guide pages

### Fixed
- Shared response handling
- Git merge conflict resolution improvements

---

## [0.1.4] - 2026-02-01

### Added
- **Multi-Value Headers**: Support for headers with multiple values
- **Cookie Management**: Improved cookie handling in requests
- **Rust Backend Logging**: Redirect Rust layer logs to the in-app console
- **User Guide**: Additional documentation pages

### Fixed
- External mock path parameters handling
- Compilation errors

---

## [0.1.3] - 2026-01-20

### Added
- **Custom App Icons**: New cURL-UI application icons

### Fixed
- Query parameters handling and edge cases

---

## [0.1.2] - 2026-01-15

### Fixed
- Splitted input field rendering issues

---

## [0.1.1] - 2026-01-10

### Added
- **Version Check**: Automatic check for new application versions
- **Windows Standalone**: Raw `.exe` binary distribution for Windows

---

## [0.1.0] - 2026-01-01

### Added
- **Core Application**: Initial release of cURL-UI
- **Collections**: Create, save, and load request collections from disk
- **Requests**: Full HTTP request builder with method, URL, headers, query parameters, and body support
- **Executions**: Parameterized request executions with environment variable overrides
- **Environments**: Global, Local, Dev, Test, and Prod environment management with variable inheritance
- **Variable System**: Variable highlighting and autocompletion across editors
- **Pre/Post Scripts**: JavaScript pre-request and post-response scripting support
- **Mock Server**: Built-in collection mock server and external mock support (including Swagger import)
- **Import/Export**: cURL command import functionality
- **Git Integration**: Built-in Git panel for version control of collections
- **Project Management**: Multi-project support with welcome screen and project switching
- **Response Panel**: Response viewer with HTTP status, headers, body, and cURL preview
- **User Guide**: Integrated user guide with in-app rendering

[Unreleased]: https://github.com/Oivalf/curl-ui/compare/cURL-UI-v0.1.8...HEAD
[0.1.8]: https://github.com/Oivalf/curl-ui/compare/cURL-UI-v0.1.7...cURL-UI-v0.1.8
[0.1.7]: https://github.com/Oivalf/curl-ui/compare/cURL-UI-v0.1.6...cURL-UI-v0.1.7
[0.1.6]: https://github.com/Oivalf/curl-ui/compare/cURL-UI-v0.1.5...cURL-UI-v0.1.6
[0.1.5]: https://github.com/Oivalf/curl-ui/compare/cURL-UI-v0.1.4...cURL-UI-v0.1.5
[0.1.4]: https://github.com/Oivalf/curl-ui/compare/cURL-UI-v0.1.3...cURL-UI-v0.1.4
[0.1.3]: https://github.com/Oivalf/curl-ui/compare/cURL-UI-v0.1.2...cURL-UI-v0.1.3
[0.1.2]: https://github.com/Oivalf/curl-ui/compare/cURL-UI-v0.1.1...cURL-UI-v0.1.2
[0.1.1]: https://github.com/Oivalf/curl-ui/compare/app-v0.1.0...cURL-UI-v0.1.1
[0.1.0]: https://github.com/Oivalf/curl-ui/releases/tag/app-v0.1.0
