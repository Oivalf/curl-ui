---
name: check-license-compatibility
description: Verifies that newly added dependencies are compatible with the MIT license (permissive-only policy).
---

# Check License Compatibility Skill

This skill ensures that every new dependency added to the project follows our license policy.

## Project License: MIT

### Compatible Licenses (Permissive)
- MIT
- ISC
- Apache-2.0
- BSD-2-Clause
- BSD-3-Clause
- Unlicense
- CC0-1.0

### Incompatible/Copyleft Licenses (Block & Review)
- GPL (any version)
- AGPL (any version)
- LGPL (any version)
- MPL-2.0 (Review case-by-case)

## Instructions

Whenever you are about to add a new package (e.g., during `npm install`), you **MUST** follow these steps:

1. **Fetch License**: Run `npm view <package-name> license` to get the license type from the registry.
2. **Compare**: Check the result against the **Compatible Licenses** list above.
3. **Handle Result**:
   - **Compatible**: Proceed with the installation.
   - **Incompatible/Review**: Stop the process, inform the user about the license conflict, and wait for explicit approval before adding the package to `package.json`.
4. **Log Result**: Add a small note in the session summary or the walkthrough about the license validation if a new dependency was added.

## Tooling

Use this command to check a package's license:
```bash
npm view <package-name> license
```
