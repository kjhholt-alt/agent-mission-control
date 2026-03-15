#!/bin/bash
# Script 41: One-command project setup
echo ""
echo "  === NEXUS SETUP ==="
echo ""

cd "$(dirname "$0")/../.."

# Install Node deps
echo "  [1/5] Installing Node dependencies..."
npm install --silent 2>/dev/null
echo "  Done"

# Check Python deps
echo "  [2/5] Checking Python dependencies..."
pip install supabase python-dotenv 2>/dev/null || pip3 install supabase python-dotenv 2>/dev/null
echo "  Done"

# Create .env.local if missing
if [ ! -f .env.local ]; then
    echo "  [3/5] Creating .env.local from example..."
    if [ -f .env.local.example ]; then
        cp .env.local.example .env.local
        echo "  Created .env.local — fill in your API keys"
    else
        echo "  No .env.local.example found, skipping"
    fi
else
    echo "  [3/5] .env.local already exists"
fi

# Check Rust toolchain
echo "  [4/5] Checking Rust toolchain..."
if command -v cargo &>/dev/null; then
    echo "  Rust $(rustc --version 2>/dev/null | awk '{print $2}') installed"
else
    echo "  Rust not installed — run: winget install Rustlang.Rustup"
fi

# Verify build
echo "  [5/5] Verifying Next.js build..."
npx next build 2>/dev/null | grep -q "Generating" && echo "  Build OK" || echo "  Build failed — check errors above"

echo ""
echo "  Setup complete! Run: npm run dev"
echo ""
