@echo off
REM Legacy launcher - now delegates to the PowerShell persistent wrapper.
REM The daemon auto-starts at logon via Windows Startup folder (VBS launcher).
REM To control manually, use: powershell -File scripts\daemon-ctl.ps1 [start|stop|status|restart]

echo Starting Nexus Hive Daemon (hidden)...
wscript.exe "%~dp0nexus-daemon-launcher.vbs"
echo Daemon launched in background. Check logs\daemon.log for output.
echo Use "powershell -File scripts\daemon-ctl.ps1 status" to check status.
