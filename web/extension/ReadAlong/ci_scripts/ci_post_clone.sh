#!/bin/sh

#  ci_post_clone.sh
#  ReadAlong
#
#  Created by Antigravity on 2026-01-05.
#

echo "🧩 Post-clone script started."

# Install Node.js
echo "📦 Installing Node.js..."
brew install node

# Navigate to the extension directory
# $CI_PRIMARY_REPOSITORY_PATH points to the root of the cloned repository
EXTENSION_DIR="$CI_PRIMARY_REPOSITORY_PATH/web/extension"

echo "📂 Navigating to extension directory: $EXTENSION_DIR"
cd "$EXTENSION_DIR" || { echo "❌ Failed to navigate to directory $EXTENSION_DIR"; exit 1; }

# Install dependencies and build
echo "📦 Installing npm dependencies..."
npm install

echo "🔨 Building extension..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed."
    exit 1
fi

echo "✅ Build complete."
exit 0
