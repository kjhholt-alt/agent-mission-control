# Schedule Morning Briefing at 7:00 AM daily via Windows Task Scheduler
# Usage: powershell -ExecutionPolicy Bypass -File schedule-briefing.ps1

$TaskName = "NexusMorningBriefing"
$ScriptPath = "C:\Users\Kruz\Desktop\Projects\agent-mission-control\scripts\ops\morning-briefing.py"

Write-Host ""
Write-Host "  ===== Nexus Morning Briefing Scheduler =====" -ForegroundColor Cyan
Write-Host ""

# Remove existing task if present
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "  Removing existing task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
}

# Try schtasks.exe (works without admin for DAILY triggers)
& schtasks.exe /Create /TN $TaskName /TR "python `"$ScriptPath`"" /SC DAILY /ST 07:00 /F 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Scheduled task created!" -ForegroundColor Green
    Write-Host "  Name:     $TaskName" -ForegroundColor Gray
    Write-Host "  Schedule: Daily at 7:00 AM" -ForegroundColor Gray
    Write-Host "  Script:   $ScriptPath" -ForegroundColor Gray
} else {
    Write-Host "  schtasks failed. Trying PowerShell cmdlets..." -ForegroundColor Yellow
    try {
        $action = New-ScheduledTaskAction -Execute "python" -Argument "`"$ScriptPath`""
        $trigger = New-ScheduledTaskTrigger -Daily -At 7am
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Force | Out-Null
        Write-Host "  Scheduled task created!" -ForegroundColor Green
    } catch {
        Write-Host "  Failed: $_" -ForegroundColor Red
    }
}

Write-Host ""
