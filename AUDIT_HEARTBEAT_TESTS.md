# Nexus Heartbeat API & Test Configuration Audit
**Date**: 2026-03-17 | **Scope**: `/api/heartbeat`, Test Infrastructure, Project Configs

---

## Executive Summary

**Status**: ⚠️ **ISSUES FOUND** — 5 critical items, 3 recommendations

### Key Findings:
1. **Heartbeat API has fallback error handling** but uses deprecated Supabase upsert pattern
2. **Test suite is Python-only** (Pytest) — no TypeScript/Jest tests for APIs
3. **No test config** (jest.config.js/vitest.config.ts) — untestable TypeScript
4. **API routes lack validation** — missing input schemas and error cases
5. **Test file has hardcoded Supabase credentials** in source (security risk)

---

## 1. Heartbeat API Audit (`/api/heartbeat/route.ts`)

### ✅ What Works Well
- ✓ Proper error handling with try/catch
- ✓ Required field validation (agent_id, agent_name, project, status)
- ✓ Handles both upsert success and insert fallback
- ✓ Sets `completed_at` timestamp for terminal states (completed/failed)
- ✓ Null-coalescing for optional fields

### ⚠️ Issues Found

#### Issue #1: Deprecated Upsert Pattern (Medium)
```typescript
// ❌ CURRENT: Uses deprecated onConflict syntax
.upsert({ ... }, { onConflict: "agent_id" })

// ✅ SHOULD BE: Agent_id must be a PRIMARY KEY in Supabase
// or use: { onConflict: "agent_id" } is valid ONLY if agent_id has a unique constraint
```

**Check**: Verify `agent_activity` table schema:
- Does `agent_id` have a PRIMARY KEY or UNIQUE constraint?
- If not, upsert will fail silently and fall through to insert

**Fix**: Confirm schema or use explicit update pattern:
```typescript
const { data: existing } = await supabase
  .from("agent_activity")
  .select("id")
  .eq("agent_id", agent_id)
  .maybeSingle();

if (existing) {
  // Update
} else {
  // Insert
}
```

---

#### Issue #2: Fallback Insert May Create Duplicates (Medium)
```typescript
// ❌ CURRENT: Upsert fails → Insert fallback (lines 54-78)
if (error) {
  const { data: insertData, error: insertError } = await supabase
    .from("agent_activity")
    .insert({ ... })
```

**Problem**:
- If upsert fails due to network, duplicate agent records could be created
- Race condition: two heartbeat requests might both trigger the insert fallback
- No deduplication by agent_id on subsequent calls

**Recommendation**:
- Log upsert errors before falling back to insert
- Return error status if insert also fails (don't silently swallow)
- Consider: use explicit primary key query + update/insert logic

---

#### Issue #3: Missing Validation for `status` Field (Low)
```typescript
// No validation that status is a known enum value
if (!agent_id || !agent_name || !project || !status) { ... }
// ✅ Should validate: status ∈ ['running', 'completed', 'failed', 'paused', etc.]
```

**Fix**:
```typescript
const VALID_STATUSES = ['running', 'completed', 'failed', 'paused'];
if (!VALID_STATUSES.includes(status)) {
  return NextResponse.json(
    { error: `Invalid status: ${status}` },
    { status: 400 }
  );
}
```

---

#### Issue #4: Inconsistent Return Format (Low)
```typescript
// ❌ Lines 77 and 80 return different formats:
return NextResponse.json({ ok: true, data: insertData });  // Line 77
return NextResponse.json({ ok: true, data });              // Line 80
```

**Fix**: Standardize to one format:
```typescript
return NextResponse.json({ ok: true, data: data || insertData });
```

---

#### Issue #5: No Rate Limiting or Auth (Medium-High)
```typescript
// ❌ POST /api/heartbeat is publicly accessible (no API key check)
export async function POST(request: NextRequest) {
  // No auth check!
}
```

**Risk**: Any agent (including malicious ones) can spam heartbeats
- Could bloat `agent_activity` table with fake records
- No way to throttle per-agent

**Recommendation**: Add API key validation:
```typescript
const apiKey = request.headers.get("x-api-key");
if (apiKey !== process.env.NEXUS_API_KEY) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

---

#### Issue #6: `completed_at` Not Set on Insert (Low)
```typescript
// Lines 67-70: Insert path doesn't set completed_at for terminal states
.insert({
  agent_id,
  // ... other fields
  started_at: now,
  updated_at: now,
  // ❌ Missing: ...(isTerminal ? { completed_at: now } : {})
})
```

**Fix**: Apply same logic as upsert:
```typescript
.insert({
  agent_id,
  // ... other fields
  started_at: now,
  updated_at: now,
  ...(isTerminal ? { completed_at: now } : {}),
})
```

---

## 2. Test Configuration Audit

### Current State
```
tests/
  test_nexus.py        ✓ Exists (10 tests, Pytest)
jest.config.js         ✗ Missing
vitest.config.ts       ✗ Missing
package.json           ✓ Exists (scripts: dev, build, lint, tauri)
tsconfig.json          ✓ Exists (strict mode, good path mapping)
```

### ⚠️ Issues Found

#### Issue #7: No JavaScript Test Runner (Critical)
**Current**: Pytest only (Python backend testing)
**Missing**: Jest or Vitest for TypeScript API route testing

**Impact**:
- Cannot run tests for any `.ts` file (API routes, lib functions)
- `npm test` doesn't exist — no CI integration point
- No TypeScript type checking in tests

**Recommendation**:
```bash
npm install -D vitest @vitest/ui
# OR
npm install -D jest @types/jest ts-jest
```

---

#### Issue #8: Credentials Hardcoded in Test File (Critical Security)
**File**: `tests/test_nexus.py` lines 10-11

```python
SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"
```

**Risk**:
- ✗ Credentials visible in git history
- ✗ Public GitHub repo exposes Supabase anon key
- ✗ Anyone can query your entire Supabase project

**Fix**:
```python
import os
SB_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SB_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
```

Then in CI/local:
```bash
export NEXT_PUBLIC_SUPABASE_URL="..."
export NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
pytest tests/
```

---

#### Issue #9: No package.json Test Scripts (Low)
```json
// ❌ Missing in package.json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  // ✗ No test script!
}
```

**Should add**:
```json
"test": "vitest",
"test:ui": "vitest --ui",
"test:python": "pytest tests/ -v",
"test:all": "npm run test && npm run test:python"
```

---

#### Issue #10: No Integration Test for Heartbeat API (Critical)
**Current Python tests**: Only check Supabase table existence
**Missing**: HTTP tests for actual API routes

Should have:
```typescript
// tests/api/heartbeat.test.ts
describe('POST /api/heartbeat', () => {
  it('should accept valid heartbeat payload', async () => {
    const res = await fetch('/api/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: 'test-1',
        agent_name: 'TestAgent',
        project: 'test-project',
        status: 'running',
      }),
    });
    expect(res.status).toBe(200);
  });

  it('should reject missing required fields', async () => {
    const res = await fetch('/api/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ agent_id: 'test-1' }),
    });
    expect(res.status).toBe(400);
  });
});
```

---

## 3. Project Configuration Audit

### ✅ Good Practices
- ✓ TypeScript strict mode enabled
- ✓ Path aliases configured (`@/*`)
- ✓ Next.js 16 (latest)
- ✓ Tailwind v4 + shadcn/ui
- ✓ ESLint configured

### ⚠️ Missing Configurations

#### Missing: next.config.ts is Empty
```typescript
// ❌ CURRENT: next.config.ts
const nextConfig: NextConfig = {
  /* config options here */
};
```

**Recommendation**: Add common settings:
```typescript
const nextConfig: NextConfig = {
  // Compression for API responses
  compress: true,

  // Security headers
  headers: async () => [
    {
      source: '/api/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    },
  ],

  // Environment validation
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
};
```

---

#### Missing: .env.example
**Currently**: Users must know to set env vars manually

**Should have**: `.env.example`
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_NEXUS_API_KEY=nexus-hive-2026
NEXUS_API_KEY=nexus-hive-2026
ANTHROPIC_API_KEY=sk-...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

---

#### Missing: .env.local in .gitignore (Verify)
**Critical**: Ensure `.env.local`, `.env.*.local`, `*.key` are in `.gitignore`

```bash
# Check current state:
cat .gitignore | grep -E "env|.local"
```

---

## 4. Summary: Actions Required

### 🔴 Critical (Do First)
1. **Remove hardcoded Supabase credentials from `test_nexus.py`** → Use env vars
2. **Add auth check to `/api/heartbeat`** → Prevent unauthorized agents
3. **Set up test runner** → Add Jest or Vitest config

### 🟠 High Priority
4. Fix heartbeat upsert pattern → Verify `agent_id` has UNIQUE constraint
5. Add integration tests for all API routes
6. Add TypeScript tests to CI pipeline

### 🟡 Medium Priority
7. Add status enum validation to heartbeat endpoint
8. Fix inconsistent heartbeat response format
9. Add `completed_at` to insert fallback path
10. Create `.env.example` file

### 🟢 Nice to Have
11. Add Turbopack configuration to `next.config.ts`
12. Add security headers to responses
13. Implement rate limiting per agent_id

---

## 5. Recommended Test Setup

### Install Vitest
```bash
npm install -D vitest @vitest/ui happy-dom
```

### Create vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Update package.json
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage"
  }
}
```

### Create tests/api/heartbeat.test.ts
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/heartbeat/route';
import { NextRequest } from 'next/server';

describe('POST /api/heartbeat', () => {
  it('should accept valid heartbeat', async () => {
    const req = new NextRequest('http://localhost/api/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: 'test-1',
        agent_name: 'TestAgent',
        project: 'test',
        status: 'running',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('should reject missing required fields', async () => {
    const req = new NextRequest('http://localhost/api/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ agent_id: 'test-1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

---

## Appendix: Related API Routes for Pattern Review

### Comparison: `/api/collector/event` vs `/api/heartbeat`
| Aspect | collector/event | heartbeat | Better |
|--------|-----------------|-----------|--------|
| Auth | ❌ None | ❌ None | collector/event (has logic for logging) |
| Error handling | ✓ Good | ✓ Good | Tie |
| Fallback logic | ❌ Fire-and-forget | ✓ Has insert | heartbeat |
| Validation | Basic | Basic | Tie |
| Response format | Standardized | Inconsistent | collector/event |

### Comparison: `/api/tasks` (GET)
| Aspect | tasks | heartbeat | Better |
|--------|-------|-----------|--------|
| Type safety | ✓ Query params validated | ❌ No body validation | tasks |
| Query building | ✓ Chain pattern | N/A | tasks |
| Error handling | ✓ Good | ✓ Good | Tie |
| Response shape | ✓ Well-defined | ⚠️ Inconsistent | tasks |

---

## File References
- Heartbeat API: `src/app/api/heartbeat/route.ts`
- Test suite: `tests/test_nexus.py`
- Config: `tsconfig.json`, `package.json`, `next.config.ts`

---

**Generated**: 2026-03-17 | **Auditor**: Claude Code
