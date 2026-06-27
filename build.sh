#!/bin/bash

set -e

echo "Syncing manifest version from .env..."
node scripts/sync-version.js

# 1. Cleaner directory
rm -rf dist
mkdir -p dist/assets/js
mkdir -p dist/assets/css

# 2. Copy files
cp manifest.json dist/
cp style.css dist/assets/css/
# Use content.source.js as the production script, but SCRAMBLE it first (High Security)
echo "Scrambling code (High Security)..."
npx javascript-obfuscator content.source.js --output dist/assets/js/content.js \
    --compact true \
    --control-flow-flattening true --control-flow-flattening-threshold 1 \
    --dead-code-injection true --dead-code-injection-threshold 1 \
    --string-array true --string-array-encoding 'rc4' \
    --disable-console-output true

# If obfuscation fails, fall back to copy (safety)
if [ ! -f dist/assets/js/content.js ]; then
    echo "Obfuscation failed, falling back to copy..."
    cp content.source.js dist/assets/js/content.js
fi

# 3. Update manifest.json paths
sed -i 's|"content.js"|"assets/js/content.js"|' dist/manifest.json
sed -i 's|"style.css"|"assets/css/style.css"|' dist/manifest.json

# Copy icons if you have them (check manifest)
# cp icon*.png dist/assets/ 2>/dev/null

# 4. Refresh unpacked extension folder
rm -rf mla-soundbar
mkdir -p mla-soundbar
cp -r dist/. mla-soundbar/

# 5. Zip it
rm -f mla-soundbar.zip
cd dist
zip -r ../mla-soundbar.zip .
cd ..

echo "========================================================"
echo "Build Complete!"
echo "Files organized in 'dist/' with 'assets/' folder."
echo "Folder output refreshed at 'mla-soundbar/'."
echo "Zip output created at 'mla-soundbar.zip'."
echo "Manifest updated dynamically."
echo "Using 'content.source.js' as the source for 'content.js'."
echo "========================================================"
