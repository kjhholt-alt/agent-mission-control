# Nexus Executor — Persistent Wrapper with Crash Recovery
# Restarts the executor automatically if it crashes.
#
# Run hidden:
#   Start-Process -WindowStyle Hidden powershell -ArgumentList "-ExecutionPolicy Bypass -File C:\Users\Kruz\Desktop\Projects\nexus\scripts\start-executor.ps1"
#
# Or via VBS launcher:
#   wscript.exe C:\Users\Kruz\Desktop\Projects\nexus\scripts\executor-hidden.vbs

$ErrorActionPreference = "Continue"
$ProjectRoot = "C:\Users\Kruz\Desktop\Projects\nexus"
Set-Location $ProjectRoot

# ── Load environment variables ────────────────────────────────────────
foreach ($envFile in @(".env.local", ".env")) {
    $path = Join-Path $ProjectRoot $envFile
    if (Test-Path $path) {
        Get-Content $path -Encoding UTF8 | ForEach-Object {
            if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
                [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
            }
        }
    }
}

# Defaults
if (-not $env:SUPABASE_URL) { $env:SUPABASE_URL = "https://ytvtaorgityczrdhhzqv.supabase.co" }
if (-not $env:SUPABASE_KEY) { $env:SUPABASE_KEY = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY }
if (-not $env:NEXUS_URL) { $env:NEXUS_URL = "https://nexus.buildkit.store" }

# ── Logging ───────────────────────────────────────────────────────────
$logDir = Join-Path $ProjectRoot "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir "executor.log"

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "$ts  $msg"
    [System.IO.File]::AppendAllText($logFile, "$line`r`n", [System.Text.Encoding]::UTF8)
    Write-Host $line
}

# ── Prevent duplicate instances ───────────────────────────────────────
$existingLock = Join-Path $logDir "executor.lock"
if (Test-Path $existingLock) {
    $lockPid = [int](Get-Content $existingLock -ErrorAction SilentlyContinue)
    $existingProc = Get-Process -Id $lockPid -ErrorAction SilentlyContinue
    if ($existingProc) {
        Write-Log "Another executor instance running (PID $lockPid). Exiting."
        exit 0
    }
}
Set-Content -Path $existingLock -Value $PID

# ── Main loop with crash recovery ────────────────────────────────────
Write-Log "=== Nexus Executor Service Starting ==="
Write-Log "PID: $PID | Working dir: $ProjectRoot"

$crashCount = 0
$maxCrashesBeforeBackoff = 5
$stdoutLog = Join-Path $logDir "executor-stdout.log"

try {
    while ($true) {
        $crashCount++
        Write-Log "Starting executor (attempt #$crashCount)..."

        try {
            $psi = New-Object System.Diagnostics.ProcessStartInfo
            $psi.FileName = "C:\Users\Kruz\AppData\Local\Python\pythoncore-3.14-64\python.exe"
            $psi.Arguments = "-u executor.py --loop --interval 15 --workers 3"
            $psi.WorkingDirectory = $ProjectRoot
            $psi.UseShellExecute = $false
            $psi.RedirectStandardOutput = $true
            $psi.RedirectStandardError = $true
            $psi.CreateNoWindow = $true

            # Pass environment variables
            foreach ($key in @("ANTHROPIC_API_KEY", "NEXUS_URL", "SUPABASE_URL", "SUPABASE_KEY",
                              "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
                              "NEXUS_API_KEY", "DISCORD_WEBHOOK_URL", "CLAUDE_CLI_PATH")) {
                $val = [System.Environment]::GetEnvironmentVariable($key, "Process")
                if ($val) { $psi.EnvironmentVariables[$key] = $val }
            }

            $proc = New-Object System.Diagnostics.Process
            $proc.StartInfo = $psi

            # Capture output to log file
            $outputHandler = {
                if ($EventArgs.Data) {
                    [System.IO.File]::AppendAllText($Event.MessageData, "$($EventArgs.Data)`r`n", [System.Text.Encoding]::UTF8)
                }
            }

            $stdoutEvent = Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action $outputHandler -MessageData $stdoutLog
            $stderrEvent = Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -Action $outputHandler -MessageData $stdoutLog

            $proc.Start() | Out-Null
            $proc.BeginOutputReadLine()
            $proc.BeginErrorReadLine()

            Write-Log "Executor started with PID: $($proc.Id)"

            # Wait for process to exit
            $proc.WaitForExit()
            $exitCode = $proc.ExitCode

            Unregister-Event -SourceIdentifier $stdoutEvent.Name -ErrorAction SilentlyContinue
            Unregister-Event -SourceIdentifier $stderrEvent.Name -ErrorAction SilentlyContinue

            Write-Log "Executor exited with code: $exitCode"

            # Clean exit (Ctrl+C / manual stop) — don't restart
            if ($exitCode -eq 0) {
                Write-Log "Clean exit. Stopping service."
                break
            }
        } catch {
            Write-Log "ERROR starting executor: $_"
        }

        # Backoff if crashing repeatedly
        if ($crashCount -ge $maxCrashesBeforeBackoff) {
            $delay = [Math]::Min(300, 10 * ($crashCount - $maxCrashesBeforeBackoff + 1))
            Write-Log "Crash loop ($crashCount). Backing off ${delay}s..."
            Start-Sleep -Seconds $delay
        } else {
            Write-Log "Restarting in 10 seconds..."
            Start-Sleep -Seconds 10
        }

        # Reset crash count periodically (every ~100 attempts = ~16 minutes at 10s interval)
        if ($crashCount -ge 100) { $crashCount = 0 }
    }
} finally {
    # Clean up lock file
    Remove-Item $existingLock -ErrorAction SilentlyContinue
    Write-Log "=== Nexus Executor Service Stopped ==="
}
