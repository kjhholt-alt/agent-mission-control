# Nexus Daemon Control Script
# Usage: powershell -File daemon-ctl.ps1 [start|stop|status|restart]

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "status", "restart")]
    [string]$Action = "status"
)

function Get-DaemonProcess {
    Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
        try {
            $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
            $cmdline -match "swarm"
        } catch { $false }
    }
}

function Get-WrapperProcess {
    Get-Process -Name "powershell" -ErrorAction SilentlyContinue | Where-Object {
        try {
            $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
            $cmdline -match "start-daemon"
        } catch { $false }
    }
}

switch ($Action) {
    "status" {
        $wrapper = Get-WrapperProcess
        $daemon = Get-DaemonProcess
        if ($wrapper) {
            Write-Host "[OK] Daemon wrapper running (PID: $($wrapper.Id -join ', '))" -ForegroundColor Green
        } else {
            Write-Host "[!!] Daemon wrapper NOT running" -ForegroundColor Red
        }
        if ($daemon) {
            Write-Host "[OK] Python swarm daemon running (PID: $($daemon.Id -join ', '))" -ForegroundColor Green
        } else {
            Write-Host "[!!] Python swarm daemon NOT running" -ForegroundColor Yellow
        }

        # Also check swarm status
        Set-Location "C:\Users\Kruz\Desktop\Projects\nexus"
        python -m swarm --status
    }

    "stop" {
        $daemon = Get-DaemonProcess
        $wrapper = Get-WrapperProcess
        if ($daemon) {
            $daemon | ForEach-Object { Stop-Process -Id $_.Id -Force; Write-Host "Killed daemon PID $($_.Id)" }
        }
        if ($wrapper) {
            $wrapper | ForEach-Object { Stop-Process -Id $_.Id -Force; Write-Host "Killed wrapper PID $($_.Id)" }
        }
        if (-not $daemon -and -not $wrapper) {
            Write-Host "No daemon processes found."
        }
        Write-Host "Daemon stopped." -ForegroundColor Yellow
    }

    "start" {
        $existing = Get-WrapperProcess
        if ($existing) {
            Write-Host "Daemon wrapper already running (PID: $($existing.Id -join ', ')). Use 'restart' instead." -ForegroundColor Yellow
            return
        }
        Write-Host "Starting daemon (hidden)..."
        $vbs = "C:\Users\Kruz\Desktop\Projects\nexus\scripts\nexus-daemon-launcher.vbs"
        Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbs`""
        Start-Sleep -Seconds 3
        $proc = Get-WrapperProcess
        if ($proc) {
            Write-Host "[OK] Daemon started (wrapper PID: $($proc.Id -join ', '))" -ForegroundColor Green
        } else {
            Write-Host "[!!] Daemon may not have started. Check logs at nexus\logs\" -ForegroundColor Red
        }
    }

    "restart" {
        Write-Host "Stopping daemon..."
        & $PSCommandPath stop
        Start-Sleep -Seconds 2
        Write-Host "Starting daemon..."
        & $PSCommandPath start
    }
}
