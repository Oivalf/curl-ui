#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: ./next-version.sh <major|minor|patch>"
  exit 1
fi

BUMP_TYPE=$1

# 1. Recupera la versione attuale
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed."
    exit 1
fi

CURRENT_VERSION=$(jq -r '.version' src-tauri/tauri.conf.json)
echo "Current version: $CURRENT_VERSION"

# 2. Calcola la nuova versione
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

if [ "$BUMP_TYPE" == "major" ]; then
  MAJOR=$((MAJOR + 1))
  MINOR=0
  PATCH=0
elif [ "$BUMP_TYPE" == "minor" ]; then
  MINOR=$((MINOR + 1))
  PATCH=0
elif [ "$BUMP_TYPE" == "patch" ]; then
  PATCH=$((PATCH + 1))
else
  echo "Invalid argument. Use: major, minor, or patch"
  exit 1
fi

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "Next version: $NEW_VERSION"

# 3. Richiama update-version.sh
./update-version.sh "$NEW_VERSION"
