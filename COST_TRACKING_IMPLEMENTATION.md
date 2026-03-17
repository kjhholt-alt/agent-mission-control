# Cost Tracking System Implementation

## ✅ Completed

### 1. Database Schema
Created `supabase_migration_cost_tracking.sql` with:
- `cost_tracking` table (tracks tokens, cost, model per operation)
- `cost_budget_alerts` table (configurable budget thresholds)
- `daily_cost_summary` view (aggregated daily costs)
- `project_cost_summary` view (aggregated project costs)
- Indexes for efficient querying

### 2. API Routes
**`/api/costs` (GET/POST)**
- POST: Log cost entries (project, tokens_in, tokens_out, cost_usd, model, operation_type)
- GET: Query costs with filters (project, model, date range, group_by)
- Automatically checks and triggers budget alerts on POST

**`/api/costs/alerts` (GET/POST/DELETE)**
- Manage budget alerts (daily/weekly/monthly thresholds)
- Project-specific or global alerts
- Discord webhook notifications when thresholds exceeded

### 3. Cost Dashboard (`/costs`)
Features:
- **Summary cards**: Total spend, last 7 days, avg daily, projected monthly
- **Daily spend chart**: Last 30 days line chart
- **Project breakdown**: Bar chart + pie chart
- **Budget alerts UI**: Create/delete alerts with configurable thresholds
- Responsive design with Nexus theme (cyan/emerald/amber/red)

### 4. Executor Integration (`executor.py`)
Added cost tracking to all task completions:
- `estimate_cost()` function calculates tokens and cost based on:
  - Prompt length and output length (1 token ≈ 4 chars)
  - Model pricing: Haiku ($0.25/$1.25), Sonnet ($3/$15), Opus ($15/$75) per 1M tokens
- `log_cost()` sends cost data to `/api/costs` endpoint
- Updates `swarm_tasks.actual_cost_cents` field
- Logs costs for completed, failed, and rejected tasks

### 5. Navigation
Added `/costs` link to main navigation bar in layout.tsx

### 6. Documentation
Updated `CLAUDE.md` with:
- New `/costs` page entry
- New API routes
- New Supabase tables

## 🔧 Next Steps (User Action Required)

### Run SQL Migration in Supabase

1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/ytvtaorgityczrdhhzqv/sql
2. Copy and paste the contents of `supabase_migration_cost_tracking.sql`
3. Click "Run" to create the tables and views

**OR** Use Supabase CLI:
```bash
supabase db push
```

### Test the System

1. Start the executor to generate some cost data:
   ```bash
   python executor.py --loop
   ```

2. Visit the dashboard:
   ```
   http://localhost:3000/costs
   ```

3. Create a test budget alert (e.g., $1 daily threshold)

4. Run a few tasks to see costs accumulate

### Budget Alert Setup

Example alerts to create:
- **Daily Development**: $5.00 threshold, daily, all projects
- **MoneyPrinter Watch**: $2.00 threshold, daily, project_filter: "MoneyPrinter"
- **Monthly Cap**: $50.00 threshold, monthly, all projects

Alerts will post to Discord when exceeded.

## 📊 Cost Estimates

The executor uses token-based cost estimation:
- **Input tokens** = prompt_length / 4
- **Output tokens** = output_length / 4

Pricing per 1M tokens:
| Model | Input | Output |
|-------|-------|--------|
| Haiku | $0.25 | $1.25 |
| Sonnet | $3.00 | $15.00 |
| Opus | $15.00 | $75.00 |

Note: These are estimates. Actual Claude API costs may vary slightly.

## 🏗️ Architecture

```
┌─────────────┐
│ executor.py │──────┐
└─────────────┘      │
                     │ POST /api/costs
┌─────────────┐      │
│ oracle.py   │──────┤
└─────────────┘      │
                     ▼
              ┌──────────────┐
              │ /api/costs   │
              └──────┬───────┘
                     │
              ┌──────▼────────────┐
              │ cost_tracking     │
              │ cost_budget_alerts│
              └───────────────────┘
                     │
              ┌──────▼───────┐
              │ /costs page  │
              │ (dashboard)  │
              └──────────────┘
```

## 🎯 Future Enhancements

- [ ] Add cost tracking to oracle queries
- [ ] Real-time cost alerts via WebSocket
- [ ] Cost attribution by user/agent
- [ ] Export cost reports as CSV/PDF
- [ ] Cost forecasting based on historical trends
- [ ] Integration with actual Claude API usage (if API provides token counts)
- [ ] Cost breakdown by task type
- [ ] Budget remaining visualizations

## 📦 Build Output

```
✓ Compiled successfully
Route (app)
├ ○ /costs                     [NEW]
├ ƒ /api/costs                 [NEW]
├ ƒ /api/costs/alerts          [NEW]
```

Build time: 7.3s
Static pages: 50
No errors or warnings.
