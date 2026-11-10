#!/bin/sh
# Render banner.html to banner-light.png and banner-dark.png (2560x1280) with headless Chrome.
# Usage: sh .github/assets/render-banner.sh
set -eu
dir=$(cd "$(dirname "$0")" && pwd)
chrome=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
for theme in light dark; do
  profile=$(mktemp -d)
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size=1280,640 --virtual-time-budget=4000 --user-data-dir="$profile" \
    --screenshot="$dir/banner-$theme.png" "file://$dir/banner.html#$theme" >/dev/null 2>&1
  rm -rf "$profile"
  echo "$dir/banner-$theme.png"
done
