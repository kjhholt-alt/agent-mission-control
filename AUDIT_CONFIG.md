# Nexus ESLint & TypeScript Config Audit
**Date**: 2026-03-17 | **Next.js**: 16.1.6 | **React**: 19.2.3 | **TypeScript**: 5

---

## Executive Summary

**Status**: ⚠️ **NEEDS FIXING**
- **ESLint**: 93 problems found (55 errors, 38 warnings)
- **TypeScript**: Config is solid but outdated target
- **Critical**: 5+ runtime issues blocking code quality

---

## TypeScript Config Analysis

### ✅ Strengths
- Strict mode enabled (`"strict": true`)
- Next.js plugin configured
- Path aliases (`@/*`)
- Proper module resolution (`bundler`)
- JSX React 17+ syntax (`"react-jsx"`)

### ❌ Issues & Recommendations

| Issue | Current | Recommended | Impact |
|-------|---------|-------------|--------|
| **ES Target (OUTDATED)** | `ES2017` | `ES2020` or `ES2022` | Blocks modern syntax, hurts bundle size |
| **Missing strictness** | `strict: true` only | Add explicit flags | Unclear intent, harder to debug |
| **NoUnusedLocals** | Not enabled | `true` | Catch dead code |
| **NoUnusedParameters** | Not enabled | `true` | Catch unused params |
| **NoImplicitReturns** | Not enabled | `true` | Catch missing return paths |

### Recommended tsconfig.json Updates
```json
{
  "compilerOptions": {
    "target": "ES2022",  // ← Updated (was ES2017)
    "lib": ["ES2022", "DOM", "DOM.Iterable"],  // ← Explicit
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    // ← Explicit strict checks (already covered by strict: true, but documenting intent)
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

---

## ESLint Config Analysis

### Current Config
✅ **Using ESLint v9 flat config format** (best practice)
✅ **Extends Next.js built-in configs** (core-web-vitals, typescript)
❌ **Missing custom rules** for project standards

### Active Issues (93 total)

#### 🔴 ERRORS (55) — Must Fix Before Shipping

**1. useState in Effects (4 instances)**
- Files: `achievements/page.tsx:61`, `command-center/page.tsx:96`, `workbench.tsx:98`, `use-command-data.ts:53`, `use-ops-data.ts:105`
- Problem: Synchronous setState calls cause cascading renders
- Rule: `react-hooks/exhaustive-deps` + pattern
- Fix: Use async fetch or move state initialization outside effect

**2. Variable Hoisting Bug (1 critical)**
- File: `lib/use-realtime-connection.ts:90`
- Problem: `attemptReconnect` used before declaration (temporal dead zone)
- Rule: `react-hooks/immutability`
- Fix: Move `attemptReconnect` callback before first use in effect

**3. Impure Functions in Render (multiple)**
- File: `components/ui/skeleton.tsx:117`
- Problem: `Math.random()` in render function breaks React purity
- Rule: `react/no-side-effects-in-render-return`
- Fix: Move to useEffect or useMemo

#### 🟡 WARNINGS (38)

**1. Unused Variables**
- `motion` in `command-center/page.tsx:4`
- `formatTokens` in `command-center/page.tsx:22`
- `workflow_id` in `api/workflows/route.ts:21`
- `err` in `api/building-activity/route.ts:80`
- Rule: `@typescript-eslint/no-unused-vars`

**2. Build Artifacts**
- Auto-generated Tauri files flagged as warnings
- Should be excluded from linting

---

## Recommended eslint.config.mjs Improvements

```javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Global ignore patterns
  globalIgnores([
    // Default Next.js ignores
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Tauri build artifacts (auto-generated)
    "src-tauri/target/**",

    // Dependencies
    "node_modules/**",

    // Dist/build outputs
    "dist/**",
  ]),

  // Custom project rules (optional but recommended)
  {
    rules: {
      // Enforce unused variable cleanup
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // React best practices
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",

      // No console in production (warn only)
      "no-console": [
        "warn",
        { allow: ["warn", "error"] },
      ],
    },
  },
]);

export default eslintConfig;
```

---

## Action Items (Priority Order)

### 🔥 CRITICAL (Fix Before Next Deploy)
- [ ] Fix `use-realtime-connection.ts` — hoisting bug will cause runtime errors
- [ ] Remove setState calls from effects (use async patterns instead)
- [ ] Remove `Math.random()` from skeleton render

### ⚠️ IMPORTANT (Fix This Week)
- [ ] Update `tsconfig.json` target to ES2022
- [ ] Add explicit strictness flags to tsconfig
- [ ] Remove all unused imports/variables
- [ ] Update eslint.config.mjs to exclude Tauri build artifacts

### 📋 NICE TO HAVE (Next Refactor)
- [ ] Add ESLint rules for import ordering (`simple-import-sort`)
- [ ] Consider adding Prettier for consistent formatting
- [ ] Add pre-commit hook (`husky`) to lint before commit

---

## Verification Steps

After fixes:
```bash
# Run ESLint with strict reporting
npm run lint

# Run TypeScript check
npx tsc --noEmit

# Verify no errors or warnings reported
npm run build
```

---

## Notes

1. **Next.js 16 defaults**: The current setup uses the latest Next.js 16 ESLint config, which is solid
2. **React 19 compatibility**: No issues found specific to React 19
3. **Tauri integration**: Build artifacts should be in `.gitignore` and globally ignored by ESLint
4. **Future consideration**: When upgrading Next.js 17+, re-run this audit
