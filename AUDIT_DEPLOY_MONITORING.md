# Nexus Deploy Monitoring & APIs Audit
**Date**: 2026-03-16
**Status**: Initial baseline established
**Plan**: Add structured logging, Vercel observability, and unified monitoring

---

## Executive Summary

Nexus has **25 functional APIs** with **4 custom monitoring checks**. The system leverages Supabase for state management but lacks modern observability infrastructure:

- ✅ **APIs**: Comprehensive, well-scoped endpoints for all operations
- ✅ **Custom monitoring**: Failure rate, stuck tasks, budget, heartbeat checks
- ⚠️ **Observability gaps**: No structured logging, no Vercel Analytics/Speed Insights, no Drains
- ⚠️ **Error tracking**: Custom `swarm_task_log` only, no external error reporting
- ⚠️ **Performance**: No real-user performance metrics or request tracing

---

## 1. API Landscape (25 Routes)

### 1.1 Data & State Management (7 routes)

| Route | Method | Auth | Purpose | Status |
|-------|--------|------|---------|--------|
| `/api/agents` | GET | Public | List all active agents | ✅ |
| `/api/agents/seed` | POST | Public | Load demo data | ✅ |
| `/api/sessions` | GET | Public | Session history | ✅ |
| `/api/tasks` | GET | Public | Task query with filters | ✅ |
| `/api/tasks/approve` | POST | API Key | Approve/reject pending | ✅ |
| `/api/memory` | GET | Public | Shared agent memory | ✅ |
| `/api/patterns` | GET | Public | Task success/fail patterns | ✅ |

### 1.2 Operations & Control (6 routes)

| Route | Method | Auth | Purpose | Status |
|-------|--------|------|---------|--------|
| `/api/spawn` | POST | API Key | Create mission | ✅ |
| `/api/deploy` | GET/POST | Mixed | Deploy management | ✅ |
| `/api/schedules` | GET/POST/DELETE | Public | Schedule management | ✅ |
| `/api/workflows` | POST | API Key | Execute workflow pipeline | ✅ |
| `/api/webhook` | POST | API Key | External triggers | ✅ |
| `/api/discord/notify` | POST | API Key | Discord notifications | ✅ |

### 1.3 Monitoring & Alerts (5 routes)

| Route | Method | Auth | Purpose | Status |
|-------|--------|------|---------|--------|
| `/api/alerts` | GET | Public | Real-time anomalies | ✅ **Custom** |
| `/api/heartbeat` | POST | Public | Worker heartbeats | ✅ |
| `/api/collector/agents` | GET | Public | Live sessions | ✅ |
| `/api/collector/event` | POST | Public | Hook events | ✅ |
| `/api/building-activity` | GET | Public | Building stats | ✅ |

### 1.4 Intelligence & Analytics (7 routes)

| Route | Method | Auth | Purpose | Status |
|-------|--------|------|---------|--------|
| `/api/oracle` | GET | Public | AI briefings | ✅ |
| `/api/oracle/chat` | POST | Public | AI conversation | ✅ |
| `/api/oracle/decisions` | GET/POST | Public | Decision tracking | ✅ |
| `/api/radiant` | GET | Public | Auto-generated quests | ✅ |
| `/api/today` | GET | Public | Daily dashboard | ✅ |
| `/api/git-activity` | GET | Public | GitHub commits | ✅ |
| `/api/export` | GET | Public | CSV/JSON export | ✅ |

---

## 2. Current Monitoring Capabilities

### 2.1 Custom Monitoring (`/api/alerts`)

**4 Active Checks:**

```
1. Task Failure Rate
   ├─ Window: Last 1 hour
   ├─ Trigger: > 50% failures
   └─ Severity: ⚠️ warning if 50-80%, 🔴 critical if > 80%

2. Stuck Running Tasks
   ├─ Window: > 30 minutes in "running" state
   ├─ Trigger: Any stuck task
   └─ Severity: ⚠️ warning if 30-60m, 🔴 critical if > 60m

3. Budget Spend Alert
   ├─ Window: Daily budget (via swarm_budgets)
   ├─ Trigger: > 80% of daily_limit_cents
   └─ Severity: ⚠️ warning at 80%, 🔴 critical at 95%

4. Worker Heartbeat
   ├─ Window: Last 15 minutes
   ├─ Trigger: No recent heartbeat from workers
   └─ Severity: ⚠️ warning if partial (>1 stale), 🔴 critical if all stale
```

### 2.2 Supabase Tables (Custom Instrumentation)

| Table | Purpose | Monitoring Use |
|-------|---------|-----------------|
| `swarm_tasks` | Task queue | Failure rate, stuck tasks, completion times |
| `swarm_task_log` | Event log | Task state transitions, deploy events |
| `swarm_workers` | Worker registry | Heartbeat tracking, XP/specialization |
| `swarm_budgets` | Cost tracking | Daily spend, budget alerts |
| `nexus_sessions` | Session tracking | Active sessions, timing |
| `nexus_hook_events` | Tool usage | Event collection from Claude Code |
| `agent_specializations` | Success patterns | Per-project task type performance |
| `agent_activity` | Heartbeats | Agent liveness |
| `oracle_decisions` | Decision history | AI decision tracking |

---

## 3. Observability Gaps

### 3.1 **Missing Vercel Analytics** ❌
- **Impact**: No real-user page views, traffic sources, or business metrics
- **Fix**: Add `@vercel/analytics` to layout.tsx (2 min setup)
- **Benefit**: Understand who uses Nexus, which pages matter, feature adoption

### 3.2 **Missing Speed Insights** ❌
- **Impact**: No real-user performance metrics (LCP, INP, CLS)
- **Fix**: Add `@vercel/speed-insights` to layout.tsx (2 min setup)
- **Benefit**: Identify slow pages, optimize high-traffic routes

### 3.3 **No Structured Logging Baseline** ❌
- **Impact**: Runtime logs are present but unstructured; difficult to parse in bulk
- **Current**: `console.log()` and `console.error()` calls
- **Missing**: JSON-structured logs with `level`, `route`, `requestId`, `duration_ms`
- **Fix**: Add logging baseline to all API routes (templates provided)
- **Benefit**: Searchable logs in Vercel Dashboard, correlate with errors

### 3.4 **No Log Drains** ❌
- **Impact**: Logs only accessible via Vercel Dashboard; no external archival
- **Requirement**: Pro plan (Hobby currently has no drains)
- **Fix**: When upgrading, configure JSON drain to Datadog or Honeycomb
- **Benefit**: Long-term log retention, custom queries, alerting

### 3.5 **No Error Tracking Integration** ❌
- **Current**: Errors logged to Supabase task_log, no centralized error tracking
- **Missing**: Sentry, Datadog, or similar error aggregation
- **Fix**: Install @sentry/nextjs or Datadog integration
- **Benefit**: Error deduplication, stack trace grouping, release tracking

### 3.6 **No Request Tracing** ❌
- **Impact**: No distributed trace linking API → Supabase → response
- **Missing**: OpenTelemetry instrumentation
- **Fix**: Add vercel-otel package (if available) or manual span tracking
- **Benefit**: End-to-end latency analysis, bottleneck identification

### 3.7 **No Instrumentation.ts** ❌
- **Impact**: No automatic instrumentation on server startup
- **Fix**: Create `instrumentation.ts` for monitoring init
- **Benefit**: Centralized observability setup, metrics collection

### 3.8 **Deployment Monitoring is Manual** ⚠️
- **Current**: `/api/deploy` creates tasks, logs to task_log
- **Missing**: Integration with Vercel deployment events (git push → build logs)
- **Gap**: Can't directly see Vercel build output or deployment status
- **Workaround**: Use Vercel CLI (`vercel logs`) or REST API `/v3/deployments/:id/events`

---

## 4. Structured Logging Audit

### 4.1 Current Logging Practices

**Example: `/api/deploy` route**

```typescript
// Current (unstructured)
supabase.from("swarm_task_log").insert({ ... })
```

**Issues:**
- ❌ No timing information
- ❌ No request IDs for correlation
- ❌ No error context
- ❌ Logs scattered across Supabase — not available in Vercel's runtime logs

### 4.2 Recommended Baseline

Add to **every API route** (template):

```typescript
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const start = Date.now()
  const requestId = request.headers.get("x-vercel-id") || crypto.randomUUID()

  console.log(JSON.stringify({
    level: "info",
    msg: "start",
    route: "/api/example",
    method: "POST",
    requestId,
  }))

  try {
    const body = await request.json()
    // ... your logic ...
    const duration = Date.now() - start

    console.log(JSON.stringify({
      level: "info",
      msg: "done",
      route: "/api/example",
      requestId,
      duration_ms: duration,
      status: 200,
    }))

    return NextResponse.json({ ok: true })
  } catch (error) {
    const duration = Date.now() - start
    console.error(JSON.stringify({
      level: "error",
      msg: "failed",
      route: "/api/example",
      requestId,
      duration_ms: duration,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }))

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    )
  }
}
```

### 4.3 Impact

| Before | After |
|--------|-------|
| Logs scattered (Supabase, console) | All logs in Vercel Dashboard at `https://vercel.com/{team}/nexus/logs` |
| Manual correlation | Automatic correlation via requestId |
| No duration tracking | Every API call timed |
| Generic error messages | Stack traces + error context |

---

## 5. Deployment Monitoring Roadmap

### Phase 1: **Structured Logging (Quick Win)** ⚡
- **Time**: 2-3 hours
- **Effort**: Template each API route
- **Benefit**: Unified logging, better debugging
- **Tools**: JSON console.log pattern
- **Result**: All 25 API routes emit structured logs

### Phase 2: **Vercel Analytics + Speed Insights** ⚡
- **Time**: 30 minutes
- **Effort**: Add 2 components to layout.tsx
- **Benefit**: Real-user metrics, page-level performance
- **Tools**: @vercel/analytics, @vercel/speed-insights
- **Result**: Dashboard at `https://vercel.com/{team}/nexus/analytics` and `https://vercel.com/{team}/nexus/speed-insights`

### Phase 3: **Error Tracking** (Medium)
- **Time**: 1-2 hours
- **Effort**: Install + configure Sentry or Datadog
- **Benefit**: Error deduplication, stack trace grouping
- **Tools**: @sentry/nextjs or datadog integration
- **Result**: Centralized error dashboard

### Phase 4: **Log Drains** (When Ready)
- **Plan Required**: Pro (currently Hobby)
- **Time**: 30 minutes
- **Benefit**: Long-term log retention, external analysis
- **Tools**: Datadog, Honeycomb, Splunk
- **Result**: Logs forwarded automatically; custom queries

### Phase 5: **Distributed Tracing** (Nice-to-Have)
- **Time**: 2-3 hours
- **Effort**: Add span instrumentation to hot paths
- **Benefit**: End-to-end latency analysis
- **Tools**: OpenTelemetry or Sentry tracing
- **Result**: Full request waterfall visualization

---

## 6. API Authentication Audit

### Current Setup

**Location**: `src/middleware.ts`

```
Public GET Endpoints: All dashboard reads
Public POST Endpoints:
  - /api/agents/seed
  - /api/collector/event    ← Claude Code hooks
  - /api/heartbeat          ← Agent heartbeats
  - /api/oracle*            ← AI endpoints

Protected: All other POST/PUT/DELETE
Auth Method: x-nexus-key or Bearer token (default: "nexus-hive-2026")
```

### 6.1 Observations

✅ **Good:**
- Separates read (public) from write (protected)
- Supports both header styles (x-nexus-key and Bearer)
- Public endpoints needed for Claude Code hooks are open

⚠️ **Considerations:**
- Default key in code — should be env var only
- No request signing for webhooks
- No CORS headers (check if needed for frontend)
- No rate limiting at middleware level

### 6.2 Recommendations

1. **Ensure NEXUS_API_KEY is set in Vercel env** (not relying on default)
   ```bash
   vercel env add NEXUS_API_KEY
   ```

2. **Add request signing for `/api/webhook`** if consuming external webhooks

3. **Consider per-endpoint rate limiting** for sensitive operations

---

## 7. Available Monitoring APIs

### 7.1 Vercel Platform APIs (Not Yet Used)

| API | Endpoint | Use Case |
|-----|----------|----------|
| **Runtime Logs** | `GET /v3/deployments/:id/events` | Stream live function logs |
| **Drains** | `GET/POST /v1/drains` | Configure log forwarding (Pro+) |
| **Deployment List** | `GET /v1/deployments?projectId=` | List recent deploys |
| **Build Logs** | `GET /v1/deployments/:id/builds/:buildId/logs` | Inspect build output |
| **Analytics** | Dashboard only | Real-user analytics (no API) |
| **Speed Insights** | Dashboard only | Performance metrics (no API) |

### 7.2 Internal APIs (Custom Nexus)

```
GET  /api/alerts           → System anomalies
GET  /api/heartbeat        → Worker liveness
GET  /api/collector/agents → Active sessions
GET  /api/patterns         → Success/fail rates
GET  /api/today            → Daily aggregates
GET  /api/git-activity     → Recent commits
```

### 7.3 How to Query Vercel APIs

**Stream live deployment logs:**
```bash
curl -N -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v3/deployments/<deployment-id>/events" \
  --max-time 60
```

**List recent deployments:**
```bash
curl -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v1/deployments?projectId=$PROJECT_ID&limit=10"
```

---

## 8. Recommended Next Steps

### 🎯 **Short-term (This Week)**
1. ✅ **Add structured logging baseline** to all API routes
   - Use template provided above
   - Tests: Verify logs appear in Vercel Dashboard

2. ✅ **Add @vercel/analytics and @vercel/speed-insights**
   - Add to layout.tsx
   - Enable tracking dashboard

3. ✅ **Document Vercel API usage**
   - Create utility for streaming logs
   - Add to docs/monitoring.md

### 🎯 **Medium-term (Next Sprint)**
1. **Add Sentry for error tracking**
   - Auto-instrument Next.js
   - Configure environment variable

2. **Create monitoring dashboard**
   - Page at `/monitoring` showing alerts, logs, deployments
   - Link to Vercel dashboards

3. **Add request tracing** to hot paths
   - Correlate API → Supabase latency
   - Identify bottlenecks

### 🎯 **Long-term (When Ready)**
1. **Upgrade to Vercel Pro** for Drains
2. **Configure log drain to Datadog/Honeycomb**
3. **Build custom alerting** via drain webhooks

---

## 9. Quick Reference: Observability Commands

```bash
# View live logs (from terminal, anywhere)
vercel logs https://nexus.buildkit.store --follow

# View errors in past hour
vercel logs https://nexus.buildkit.store --level error --since 1h

# Export logs as JSON (for analysis)
vercel logs https://nexus.buildkit.store --level error --since 1h --json > errors.json

# Check current deployment status
vercel inspect https://nexus.buildkit.store

# View analytics dashboard
open "https://vercel.com/dashboard/buildkit-stores/nexus/analytics"

# View Speed Insights
open "https://vercel.com/dashboard/buildkit-stores/nexus/speed-insights"

# Stream Vercel deployment events (requires VERCEL_TOKEN)
curl -N -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v3/deployments/<deployment-id>/events"
```

---

## 10. Audit Checklist

- [x] Catalogued all 25 API routes
- [x] Identified 4 custom monitoring checks
- [x] Found 8 major observability gaps
- [x] Structured logging baseline documented
- [x] Vercel platform APIs reviewed
- [x] Authentication audit completed
- [x] Roadmap prioritized
- [ ] (Next) Implement Phase 1 (Structured Logging)
- [ ] (Next) Implement Phase 2 (Analytics + Speed Insights)
- [ ] (Next) Implement Phase 3 (Error Tracking)

---

## File References

- **API Routes**: `src/app/api/*/route.ts` (25 total)
- **Middleware**: `src/middleware.ts`
- **Layout** (observability setup): `src/app/layout.tsx`
- **Alerts Implementation**: `src/app/api/alerts/route.ts` (80 lines)
- **Deploy Management**: `src/app/api/deploy/route.ts`

---

**Report Generated**: 2026-03-16 21:54
**Audit Status**: ✅ Complete
**Next Action**: Review roadmap priorities and start Phase 1 implementation
