# Nexus Hive Daemon - Persistent Wrapper
# Restarts the daemon automatically if it crashes.
# Run hidden: Start-Process -WindowStyle Hidden powershell -ArgumentList "-ExecutionPolicy Bypass -File C:\Users\Kruz\Desktop\Projects\nexus\scripts\start-daemon.ps1"

$ErrorActionPreference = "Continue"
Set-Location "C:\Users\Kruz\Desktop\Projects\nexus"

# Load env vars from .env.local
if (Test-Path ".env.local") {
    Get-Content ".env.local" -Encoding UTF8 | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

# Load env vars from .env (override)
if (Test-Path ".env") {
    Get-Content ".env" -Encoding UTF8 | ForEach-Object {
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
$stdoutLog = Join-Path $logDir "daemon-stdout.log"
$stderrLog = Join-Path $logDir "daemon-stderr.log"

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "$ts $msg"
    [System.IO.File]::AppendAllText($logFile, "$line`r`n", [System.Text.Encoding]::UTF8)
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
        # Use System.Diagnostics.Process for proper redirection
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "python"
        $psi.Arguments = "-u -m swarm.daemon"
        $psi.WorkingDirectory = "C:\Users\Kruz\Desktop\Projects\nexus"
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true

        # Pass environment
        foreach ($key in @("ANTHROPIC_API_KEY", "NEXUS_URL", "SUPABASE_URL", "SUPABASE_KEY",
                          "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
                          "NEXUS_API_KEY", "DISCORD_WEBHOOK_URL")) {
            $val = [System.Environment]::GetEnvironmentVariable($key, "Process")
            if ($val) {
                $psi.EnvironmentVariables[$key] = $val
            }
        }

        $proc = New-Object System.Diagnostics.Process
        $proc.StartInfo = $psi

        # Async output capture to files
        $stdoutSb = New-Object System.Text.StringBuilder
        $stderrSb = New-Object System.Text.StringBuilder

        $stdoutHandler = {
            if ($EventArgs.Data) {
                [System.IO.File]::AppendAllText($Event.MessageData, "$($EventArgs.Data)`r`n", [System.Text.Encoding]::UTF8)
            }
        }
        $stderrHandler = {
            if ($EventArgs.Data) {
                [System.IO.File]::AppendAllText($Event.MessageData, "$($EventArgs.Data)`r`n", [System.Text.Encoding]::UTF8)
            }
        }

        $stdoutEvent = Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action $stdoutHandler -MessageData $stdoutLog
        $stderrEvent = Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -Action $stderrHandler -MessageData $stderrLog

        $proc.Start() | Out-Null
        $proc.BeginOutputReadLine()
        $proc.BeginErrorReadLine()

        Write-Log "Daemon started with PID: $($proc.Id)"

        $proc.WaitForExit()
        $exitCode = $proc.ExitCode

        Unregister-Event -SourceIdentifier $stdoutEvent.Name -ErrorAction SilentlyContinue
        Unregister-Event -SourceIdentifier $stderrEvent.Name -ErrorAction SilentlyContinue

        Write-Log "Daemon exited with code: $exitCode"
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
