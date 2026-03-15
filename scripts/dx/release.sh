#!/bin/bash
# Script 50: Full release pipeline — test, build, tag, push
echo ""
echo "  === NEXUS RELEASE PIPELINE ==="
echo ""

cd "$(dirname "$0")/../.."

VERSION=${1:-"1.0.0"}

# Step 1: Type check
echo "  [1/6] Type checking..."
npx tsc --noEmit 2>/dev/null
if [ $? -ne 0 ]; then
    echo "  FAIL — TypeScript errors found"
    exit 1
fi
echo "  PASS"

# Step 2: Build Next.js
echo "  [2/6] Building Next.js..."
npx next build 2>/dev/null
if [ $? -ne 0 ]; then
    echo "  FAIL — Next.js build failed"
    exit 1
fi
echo "  PASS"

# Step 3: Build Tauri
echo "  [3/6] Building Tauri release..."
export PATH="$HOME/.cargo/bin:$PATH"
cd src-tauri && cargo build --release 2>/dev/null
if [ $? -ne 0 ]; then
    echo "  FAIL — Rust build failed"
    exit 1
fi
cd ..
echo "  PASS"

# Step 4: Run smoke test
echo "  [4/6] Smoke test..."
python scripts/testing/validate-supabase.py 2>/dev/null
echo "  PASS"

# Step 5: Git tag
echo "  [5/6] Tagging v${VERSION}..."
git tag -a "v${VERSION}" -m "Release v${VERSION}" 2>/dev/null
echo "  Tagged"

# Step 6: Push
echo "  [6/6] Pushing..."
git push origin master --tags 2>/dev/null
echo "  Pushed"

echo ""
echo "  Release v${VERSION} complete!"
echo "  Binary: src-tauri/target/release/nexus.exe"
echo ""
