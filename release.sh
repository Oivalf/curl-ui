#!/bin/bash

VERSION=$(jq -r .version src-tauri/tauri.conf.json)
CURRENT_DATE=$(date +%Y-%m-%d)
echo "version $VERSION"

sed -i "s/## \[Unreleased\].*/## \[$VERSION\] - $CURRENT_DATE/" CHANGELOG.md

git add CHANGELOG.md
git commit --allow-empty -m"RELEASE v$VERSION" && git pull && git push