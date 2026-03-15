#!/bin/bash
# Script 46: Report Next.js bundle size breakdown
echo ""
echo "  === NEXUS BUNDLE SIZE ==="
echo ""

cd "$(dirname "$0")/../.."

# Build and capture output
npx next build 2>&1 | grep -E "^[├└┌].*[○ƒ]" | while read line; do
    echo "  $line"
done

echo ""

# Check .next size
if [ -d ".next" ]; then
    size=$(du -sh .next 2>/dev/null | awk '{print $1}')
    echo "  .next directory: $size"
fi

# Check static chunks
if [ -d ".next/static/chunks" ]; then
    echo ""
    echo "  Largest chunks:"
    ls -lhS .next/static/chunks/*.js 2>/dev/null | head -10 | awk '{print "    " $5 "  " $NF}'
fi
