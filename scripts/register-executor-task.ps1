# Register Nexus Executor as a Windows Scheduled Task
# Runs at user logon with crash recovery wrapper
#
# Usage: powershell -ExecutionPolicy Bypass -File register-executor-task.ps1
# To remove: schtasks /Delete /TN "NexusExecutor" /F

$TaskName = "NexusExecutor"
$VBSPath = "C:\Users\Kruz\Desktop\Projects\agent-mission-control\scripts\executor-hidden.vbs"

Write-Host ""
Write-Host "  ===== Nexus Executor - Task Scheduler Setup =====" -ForegroundColor Cyan
Write-Host ""

# Check if task already exists
$queryResult = & schtasks.exe /Query /TN $TaskName 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Task '$TaskName' already exists. Removing..." -ForegroundColor Yellow
    & schtasks.exe /Delete /TN $TaskName /F | Out-Null
}

# Create the scheduled task using schtasks.exe directly
# SC ONLOGON works without admin when not requesting HIGHEST
$createArgs = @(
    "/Create",
    "/TN", $TaskName,
    "/TR", "wscript.exe `"$VBSPath`"",
    "/SC", "ONLOGON",
    "/F"
)

& schtasks.exe @createArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "  Task '$TaskName' created successfully!" -ForegroundColor Green
    Write-Host "  Trigger:  At logon" -ForegroundColor Gray
    Write-Host "  Action:   wscript.exe $VBSPath" -ForegroundColor Gray
    Write-Host ""

    # Start it now
    Write-Host "  Starting executor now..." -ForegroundColor Cyan
    & schtasks.exe /Run /TN $TaskName | Out-Null
    Start-Sleep -Seconds 5

    # Verify it's running
    $pythonProcs = Get-WmiObject Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*executor*" }
    if ($pythonProcs) {
        $procId = if ($pythonProcs -is [array]) { $pythonProcs[0].ProcessId } else { $pythonProcs.ProcessId }
        Write-Host "  Executor is running (PID $procId)" -ForegroundColor Green
    } else {
        Write-Host "  Executor may still be starting up. Check logs at:" -ForegroundColor Yellow
        Write-Host "    C:\Users\Kruz\Desktop\Projects\agent-mission-control\logs\executor.log" -ForegroundColor Gray
    }
} else {
    Write-Host "  Failed to create task." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Alternative: Add a shortcut to the Startup folder:" -ForegroundColor Yellow
    Write-Host "    1. Press Win+R, type: shell:startup" -ForegroundColor Gray
    Write-Host "    2. Create a shortcut to: $VBSPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Or run directly:" -ForegroundColor Yellow
    Write-Host "    wscript.exe `"$VBSPath`"" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  Management commands:" -ForegroundColor White
Write-Host "    schtasks /Query  /TN $TaskName        # Check status" -ForegroundColor Gray
Write-Host "    schtasks /Run    /TN $TaskName        # Start now" -ForegroundColor Gray
Write-Host "    schtasks /End    /TN $TaskName        # Stop" -ForegroundColor Gray
Write-Host "    schtasks /Delete /TN $TaskName /F     # Remove" -ForegroundColor Gray
Write-Host ""
