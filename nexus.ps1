# NEXUS Desktop App Manager
# Usage: powershell -File nexus.ps1 <command>
# Commands: start, stop, restart, status, build, dev, kill-all

$ErrorActionPreference = "SilentlyContinue"
$ExePath = "$PSScriptRoot\src-tauri\target\release\nexus.exe"
$ProjectRoot = $PSScriptRoot

function Get-NexusProcesses {
    Get-Process -Name "nexus" -ErrorAction SilentlyContinue
}

function Show-Status {
    $procs = Get-NexusProcesses
    if ($procs) {
        Write-Host "`n  NEXUS STATUS: " -NoNewline
        Write-Host "RUNNING" -ForegroundColor Green
        foreach ($p in $procs) {
            $uptime = (Get-Date) - $p.StartTime
            $uptimeStr = "{0:hh\:mm\:ss}" -f $uptime
            Write-Host "    PID $($p.Id) | Memory: $([math]::Round($p.WorkingSet64/1MB, 1))MB | Uptime: $uptimeStr"
        }
    } else {
        Write-Host "`n  NEXUS STATUS: " -NoNewline
        Write-Host "STOPPED" -ForegroundColor Red
    }

    # Check daemon
    $daemon = Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*swarm*daemon*"
    }
    if ($daemon) {
        Write-Host "  DAEMON:      " -NoNewline
        Write-Host "RUNNING" -ForegroundColor Green -NoNewline
        Write-Host " (PID $($daemon.Id))"
    } else {
        Write-Host "  DAEMON:      " -NoNewline
        Write-Host "NOT RUNNING" -ForegroundColor Yellow
    }
    Write-Host ""
}

function Start-Nexus {
    $existing = Get-NexusProcesses
    if ($existing) {
        Write-Host "  Nexus is already running (PID $($existing[0].Id))" -ForegroundColor Yellow
        Write-Host "  Use 'nexus restart' to restart" -ForegroundColor Gray
        return
    }
    if (-not (Test-Path $ExePath)) {
        Write-Host "  Binary not found at $ExePath" -ForegroundColor Red
        Write-Host "  Run 'nexus build' first" -ForegroundColor Gray
        return
    }
    Start-Process $ExePath -WindowStyle Normal
    Start-Sleep -Seconds 2
    $proc = Get-NexusProcesses
    if ($proc) {
        Write-Host "  Nexus started (PID $($proc[0].Id))" -ForegroundColor Green
    } else {
        Write-Host "  Failed to start Nexus" -ForegroundColor Red
    }
}

function Stop-Nexus {
    $procs = Get-NexusProcesses
    if (-not $procs) {
        Write-Host "  Nexus is not running" -ForegroundColor Gray
        return
    }
    $procs | Stop-Process -Force
    Start-Sleep -Seconds 1
    $remaining = Get-NexusProcesses
    if ($remaining) {
        Write-Host "  Some processes still running, force killing..." -ForegroundColor Yellow
        $remaining | Stop-Process -Force
    }
    Write-Host "  Nexus stopped" -ForegroundColor Green
}

function Restart-Nexus {
    Write-Host "  Stopping..."
    Stop-Nexus
    Start-Sleep -Seconds 1
    Write-Host "  Starting..."
    Start-Nexus
}

function Build-Nexus {
    Write-Host "  Building Nexus release binary..." -ForegroundColor Cyan
    $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
    Push-Location "$ProjectRoot\src-tauri"
    & cargo build --release 2>&1 | ForEach-Object {
        if ($_ -match "Compiling nexus") { Write-Host "  $_" -ForegroundColor Cyan }
        elseif ($_ -match "error") { Write-Host "  $_" -ForegroundColor Red }
        elseif ($_ -match "Finished") { Write-Host "  $_" -ForegroundColor Green }
    }
    Pop-Location
}

function Start-Dev {
    Write-Host "  Starting Tauri dev mode..." -ForegroundColor Cyan
    $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
    Push-Location $ProjectRoot
    & npx tauri dev
    Pop-Location
}

# Main
$command = if ($args.Count -gt 0) { $args[0] } else { "status" }

Write-Host ""
Write-Host "  ===== NEXUS =====" -ForegroundColor Cyan

switch ($command.ToLower()) {
    "start"    { Start-Nexus }
    "stop"     { Stop-Nexus }
    "restart"  { Restart-Nexus }
    "status"   { Show-Status }
    "build"    { Build-Nexus }
    "dev"      { Start-Dev }
    "kill-all" {
        Get-Process -Name "nexus" -ErrorAction SilentlyContinue | Stop-Process -Force
        Write-Host "  All Nexus processes killed" -ForegroundColor Green
    }
    default {
        Write-Host ""
        Write-Host "  Commands:" -ForegroundColor White
        Write-Host "    start    - Launch Nexus.exe"
        Write-Host "    stop     - Kill all Nexus processes"
        Write-Host "    restart  - Stop then start"
        Write-Host "    status   - Show running status + daemon"
        Write-Host "    build    - Rebuild release binary (cargo)"
        Write-Host "    dev      - Start Tauri dev mode"
        Write-Host "    kill-all - Force kill everything"
        Write-Host ""
    }
}
Write-Host ""
