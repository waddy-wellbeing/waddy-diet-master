#!/bin/bash

# Script to convert SVG icons to PNG for push notifications
# Requires: imagemagick (install with: brew install imagemagick)

ICONS_DIR="public/icons"

echo "🎨 Converting notification icons..."

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not found. Installing..."
    echo "Run: brew install imagemagick"
    exit 1
fi

# Convert icon-192x192
if [ -f "$ICONS_DIR/icon-192x192.svg" ]; then
    convert -background none -density 300 "$ICONS_DIR/icon-192x192.svg" -resize 192x192 "$ICONS_DIR/icon-192x192.png"
    echo "✅ Created icon-192x192.png"
else
    echo "❌ icon-192x192.svg not found"
fi

# Convert badge-72x72
if [ -f "$ICONS_DIR/badge-72x72.svg" ]; then
    convert -background none -density 300 "$ICONS_DIR/badge-72x72.svg" -resize 72x72 "$ICONS_DIR/badge-72x72.png"
    echo "✅ Created badge-72x72.png"
else
    echo "❌ badge-72x72.svg not found"
fi

echo ""
echo "📦 Icon files created in $ICONS_DIR/"
ls -lh "$ICONS_DIR"/*.png 2>/dev/null || echo "No PNG files created"
