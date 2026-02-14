#!/bin/bash

VERSION=$(jq -r .version src-tauri/tauri.conf.json)
echo "version $VERSION"
git commit --allow-empty -m"RELEASE v$VERSION" && git pull && git push