#!/bin/bash
# Script 47: Run TypeScript strict check + ESLint
echo ""
echo "  === TYPE CHECK + LINT ==="
echo ""

cd "$(dirname "$0")/../.."

echo "  [1/2] TypeScript check..."
npx tsc --noEmit 2>&1 | head -30
TSC_EXIT=$?

echo ""
echo "  [2/2] ESLint..."
npx eslint src/ --max-warnings 0 2>&1 | head -30
LINT_EXIT=$?

echo ""
if [ $TSC_EXIT -eq 0 ] && [ $LINT_EXIT -eq 0 ]; then
    echo "  ALL CHECKS PASSED"
else
    echo "  CHECKS FAILED"
    [ $TSC_EXIT -ne 0 ] && echo "    TypeScript: FAIL"
    [ $LINT_EXIT -ne 0 ] && echo "    ESLint: FAIL"
fi
