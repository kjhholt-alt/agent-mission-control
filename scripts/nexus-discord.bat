@echo off
title Nexus Discord Bot
cd /d C:\Users\Kruz\Desktop\Projects\nexus

REM Load env vars from .env file if present
if exist .env (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        set "%%A=%%B"
    )
)

if not defined DISCORD_BOT_TOKEN (
    echo ERROR: DISCORD_BOT_TOKEN not set. Add it to .env
    pause
    exit /b 1
)

python -m swarm.discord_bot
