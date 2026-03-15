# Nexus Hive Daemon - Persistent Wrapper
# Restarts the daemon automatically if it crashes.
# Run hidden: Start-Process -WindowStyle Hidden powershell -ArgumentList "-ExecutionPolicy Bypass -File C:\Users\Kruz\Desktop\Projects\nexus\scripts\start-daemon.ps1"

Set-Location "C:\Users\Kruz\Desktop\Projects\nexus"

# Load env vars from .env.local
if (Test-Path ".env.local") {
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

# Load env vars from .env (override)
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

# Defaults
if (-not $env:SUPABASE_URL) { $env:SUPABASE_URL = "https://ytvtaorgityczrdhhzqv.supabase.co" }
if (-not $env:NEXUS_URL) { $env:NEXUS_URL = "https://nexus.buildkit.store" }
if (-not $env:SUPABASE_KEY) { $env:SUPABASE_KEY = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY }

# Log file
$logDir = "C:\Users\Kruz\Desktop\Projects\nexus\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir "daemon.log"

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $msg" | Tee-Object -FilePath $logFile -Append
}

Write-Log "=== Nexus Hive Daemon Wrapper Starting ==="
Write-Log "PID: $PID"
Write-Log "Working dir: $(Get-Location)"

$crashCount = 0
$maxCrashesBeforeBackoff = 5

while ($true) {
    $crashCount++
    Write-Log "Starting daemon (attempt #$crashCount)..."

    try {
        $proc = Start-Process -FilePath "python" -ArgumentList "-m swarm.daemon" `
            -WorkingDirectory "C:\Users\Kruz\Desktop\Projects\nexus" `
            -NoNewWindow -PassThru -Wait `
            -RedirectStandardOutput (Join-Path $logDir "daemon-stdout.log") `
            -RedirectStandardError (Join-Path $logDir "daemon-stderr.log")

        Write-Log "Daemon exited with code: $($proc.ExitCode)"
    } catch {
        Write-Log "ERROR starting daemon: $_"
    }

    # Backoff if crashing repeatedly
    if ($crashCount -ge $maxCrashesBeforeBackoff) {
        $delay = [Math]::Min(300, 10 * ($crashCount - $maxCrashesBeforeBackoff + 1))
        Write-Log "Crash loop detected ($crashCount crashes). Backing off $delay seconds..."
        Start-Sleep -Seconds $delay
    } else {
        Write-Log "Restarting in 10 seconds..."
        Start-Sleep -Seconds 10
    }

    # Reset crash count every hour
    if ($crashCount -ge 360) { $crashCount = 0 }
}
