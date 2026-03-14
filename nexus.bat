@echo off
REM Set env vars before running: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_KEY
cd /d C:\Users\Kruz\Desktop\Projects\nexus
if not defined ANTHROPIC_API_KEY (
    echo ERROR: ANTHROPIC_API_KEY not set
    exit /b 1
)
set NEXUS_URL=https://nexus.buildkit.store
python -m swarm %*
