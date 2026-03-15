@echo off
REM Launcher for the Nexus Hive Daemon (hidden PowerShell)
REM Used by Task Scheduler to start at logon
start /min powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -NoProfile -File "C:\Users\Kruz\Desktop\Projects\nexus\scripts\start-daemon.ps1"
