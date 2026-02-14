#!/bin/bash

# check for version argument
if [ -z "$1" ]; then
    echo "Usage: ./update-version.sh <new_version>"
    echo "Example: ./update-version.sh 0.1.2"
    exit 1
fi

NEW_VERSION=$1
echo "Updating version to: $NEW_VERSION"

# 1. Update package.json and package-lock.json
# npm version updates both and handles syncing
echo "Updating package.json and package-lock.json..."
npm version "$NEW_VERSION" --no-git-tag-version

# 2. Update tauri.conf.json
echo "Updating src-tauri/tauri.conf.json..."
sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json

# 3. Update Cargo.toml
echo "Updating src-tauri/Cargo.toml..."
sed -i "0,/version = \".*\"/s/version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml

# 4. Update Cargo.lock
echo "Updating src-tauri/Cargo.lock (via cargo check)..."
cd src-tauri
cargo check
cd ..

echo "Done! Version updated successfully in all files."
