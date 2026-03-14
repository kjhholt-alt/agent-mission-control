@echo off
title Nexus Hive Daemon
cd /d C:\Users\Kruz\Desktop\Projects\nexus

REM Load env vars from .env file if present
if exist .env (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        set "%%A=%%B"
    )
)

REM Override/set required vars (edit these or rely on .env)
if not defined ANTHROPIC_API_KEY (
    echo ERROR: ANTHROPIC_API_KEY not set. Add it to .env or set it in this file.
    pause
    exit /b 1
)
if not defined SUPABASE_URL set SUPABASE_URL=https://ytvtaorgityczrdhhzqv.supabase.co
if not defined NEXUS_URL set NEXUS_URL=https://nexus.buildkit.store

python -m swarm.daemon
