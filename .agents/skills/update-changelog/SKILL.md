---
name: update-changelog
description: Keeps CHANGELOG.md updated after every code change made during a conversation.
---

# Update Changelog

## When to Run

This skill MUST be executed **at the end of every conversation turn where code changes were made** to the project. This includes:
- Bug fixes
- New features
- Refactoring
- Configuration changes
- Dependency updates
- Removals

Do NOT run this skill if the conversation only involved:
- Reading/analyzing code without changes
- Answering questions
- Creating documentation-only artifacts (not in the repo)

## Instructions

### 1. Identify What Changed

Review all the file modifications you made during this conversation turn. Categorize each change into one of these types:

| Category | When to use |
|----------|-------------|
| `Added` | New features, new capabilities, new files |
| `Changed` | Changes to existing functionality, refactoring, UI updates |
| `Deprecated` | Features that will be removed in future versions |
| `Removed` | Removed features or files |
| `Fixed` | Bug fixes |
| `Security` | Vulnerability fixes |

### 2. Read the Current Changelog

Read the file `CHANGELOG.md` in the project root. Look at the `[Unreleased]` section at the top.

### 3. Update the `[Unreleased]` Section

Add your changes under the appropriate category heading inside the `[Unreleased]` section.

**Rules:**
- Only modify the `[Unreleased]` section. Never touch released version sections.
- Each entry should be a single bullet point, concise but descriptive.
- Use **bold** for the component/area name when relevant (e.g., `**macOS**:`, `**Sidebar**:`, `**TabBar**:`).
- Group related changes into a single entry when they are part of the same logical change.
- Do NOT duplicate entries — check if a similar entry already exists before adding.
- Write entries in English.
- Keep entries user-facing: describe *what changed for the user*, not implementation details.

**Format example:**
```markdown
## [Unreleased] - 0.1.8

### Added
- **Use Cases**: Configurable success status codes for each step

### Fixed
- **Windows**: Drag & drop not working due to WebView2 intercepting HTML5 DragEvent
- **macOS**: Application freeze when using custom title bar with transparent window

### Changed
- **ExecutionProgress**: Component is now responsive to its container size instead of window size
```

### 4. Determine the Version Number

Look at the current version in `src-tauri/tauri.conf.json` under `"version"`. The `[Unreleased]` section header should show this version number:
```markdown
## [Unreleased] - X.Y.Z
```

### 5. When a Release Happens

When the user explicitly says they are releasing a new version:
1. Replace `[Unreleased]` with the version number and today's date: `## [X.Y.Z] - YYYY-MM-DD`
2. Add a new empty `[Unreleased]` section above it
3. Update the comparison links at the bottom of the file
