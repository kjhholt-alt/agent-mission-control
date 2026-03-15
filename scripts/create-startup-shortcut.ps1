# Create a Startup folder shortcut for Nexus Executor
# This makes the executor auto-start on login without needing admin

$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder 'NexusExecutor.lnk'
$vbsPath = 'C:\Users\Kruz\Desktop\Projects\agent-mission-control\scripts\executor-hidden.vbs'

# Create shortcut
$WshShell = New-Object -ComObject WScript.Shell
$shortcut = $WshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'wscript.exe'
$shortcut.Arguments = "`"$vbsPath`""
$shortcut.WorkingDirectory = 'C:\Users\Kruz\Desktop\Projects\agent-mission-control'
$shortcut.Description = 'Nexus Executor - Auto-start on login'
$shortcut.Save()

Write-Host ""
Write-Host "  Startup shortcut created!" -ForegroundColor Green
Write-Host "  Location: $shortcutPath" -ForegroundColor Gray
Write-Host "  The executor will auto-start on next login." -ForegroundColor Cyan
Write-Host ""
