---
name: update-user-guide
description: Keeps the User Guide updated when new features are added or existing ones are substantially modified.
---

# Update User Guide

## When to Run

This skill MUST be executed **at the end of a conversation turn** if you have:
- Implemented a completely new feature.
- Substantially modified how an existing feature works from the user's perspective.
- Added new configuration options or settings.
- Changed the User Interface in a way that affects workflows or user interaction.

Do NOT run this skill if the conversation only involved:
- Code refactoring with no user-facing changes.
- Bug fixes that just restore the intended existing behavior.
- Tooling, CI/CD, or internal GitHub Action modifications.
- Translating or answering questions without making code changes.

## Instructions

### 1. Identify User-Facing Changes
Review the functionality you just added or changed. Consider:
- How does the user interact with this new feature?
- What are the steps required to use it?
- Does it introduce new UI elements, keyboard shortcuts, or configurations?

### 2. Locate the Correct Documentation File
The user guide for this project is generally located inside `src-tauri/docs/user-guide/` (or similarly named directories).
Use your file listing and searching tools to find the `.md` file that best corresponds to the feature you worked on.
If you implemented an entirely new macro-feature, you may need to create a new markdown file for it and make sure it is linked appropriately in the documentation index/sidebar.

### 3. Update the Documentation
Edit the user guide markdown file to accurately document the new changes.
- **Be clear and concise**, maintaining a professional and helpful tone.
- **Use standard Markdown** formatting for headers, code blocks, and bulleted lists.
- If you're documenting a new UI component, describe exactly where it is located.
- Provide short examples if the feature is complex (e.g., a new Use Case scripting capability or a configuration syntax).

### 4. Verify Context
Ensure your additions blend naturally with the existing documentation in that file. Avoid duplicating information that is already explained nearby.
