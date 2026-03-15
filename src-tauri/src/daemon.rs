use std::collections::VecDeque;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

// ── Types ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum DaemonStatus {
    Stopped,
    Starting,
    Running,
    Crashed,
}

#[derive(Debug, Serialize, Clone)]
pub struct DaemonInfo {
    pub status: DaemonStatus,
    pub pid: Option<u32>,
    pub uptime_seconds: Option<u64>,
    pub crash_count: u32,
    pub recent_stdout: Vec<String>,
    pub recent_stderr: Vec<String>,
}

pub struct DaemonState {
    pub status: DaemonStatus,
    pub child: Option<Child>,
    pub pid: Option<u32>,
    pub start_time: Option<Instant>,
    pub crash_count: u32,
    pub last_crash: Option<Instant>,
    pub stdout_buffer: VecDeque<String>,
    pub stderr_buffer: VecDeque<String>,
    pub should_run: bool,
}

impl Default for DaemonState {
    fn default() -> Self {
        Self {
            status: DaemonStatus::Stopped,
            child: None,
            pid: None,
            start_time: None,
            crash_count: 0,
            last_crash: None,
            stdout_buffer: VecDeque::with_capacity(100),
            stderr_buffer: VecDeque::with_capacity(100),
            should_run: true,
        }
    }
}

pub type SharedDaemon = Arc<Mutex<DaemonState>>;

// ── Environment variables ───────────────────────────────────────────

fn load_env_vars(project_root: &str) -> Vec<(String, String)> {
    let mut vars = Vec::new();

    // Hard-coded env vars (from the spec)
    let env_pairs = [
        ("ANTHROPIC_API_KEY", std::env::var("ANTHROPIC_API_KEY").unwrap_or_default()),
        ("NEXUS_URL", std::env::var("NEXUS_URL").unwrap_or_else(|_| "https://nexus.buildkit.store".into())),
        ("SUPABASE_URL", std::env::var("SUPABASE_URL").unwrap_or_else(|_| "https://ytvtaorgityczrdhhzqv.supabase.co".into())),
        ("SUPABASE_KEY", std::env::var("SUPABASE_KEY").unwrap_or_default()),
        ("DISCORD_WEBHOOK_URL", std::env::var("DISCORD_WEBHOOK_URL").unwrap_or_default()),
    ];

    for (key, val) in &env_pairs {
        if !val.is_empty() {
            vars.push((key.to_string(), val.clone()));
        }
    }

    // Also try loading from .env.local
    let env_path = format!("{}/.env.local", project_root);
    if let Ok(content) = std::fs::read_to_string(&env_path) {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, val)) = line.split_once('=') {
                let key = key.trim();
                let val = val.trim().trim_matches('"').trim_matches('\'');
                // Don't override existing env vars
                if !vars.iter().any(|(k, _)| k == key) {
                    vars.push((key.to_string(), val.to_string()));
                }
            }
        }
    }

    vars
}

fn find_python() -> String {
    for cmd in &["python", "python3", "py"] {
        if Command::new(cmd)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok()
        {
            return cmd.to_string();
        }
    }
    "python".to_string()
}

// ── Daemon lifecycle ────────────────────────────────────────────────

pub fn spawn_daemon(state: &SharedDaemon, app: &AppHandle) -> Result<(), String> {
    let mut daemon = state.lock().map_err(|e| e.to_string())?;

    if daemon.status == DaemonStatus::Running {
        return Ok(());
    }

    daemon.status = DaemonStatus::Starting;
    let _ = app.emit("daemon-status", DaemonStatus::Starting);

    let project_root = "C:/Users/Kruz/Desktop/Projects/nexus";
    let python = find_python();
    let env_vars = load_env_vars(project_root);

    let mut cmd = Command::new(&python);
    cmd.args(["-m", "swarm", "--daemon"])
        .current_dir(project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Set environment variables
    for (key, val) in &env_vars {
        cmd.env(key, val);
    }

    // On Windows, prevent console window from appearing
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    match cmd.spawn() {
        Ok(mut child) => {
            let pid = child.id();
            daemon.pid = Some(pid);
            daemon.start_time = Some(Instant::now());
            daemon.status = DaemonStatus::Running;

            // Stream stdout
            if let Some(stdout) = child.stdout.take() {
                let state_clone = Arc::clone(state);
                let app_clone = app.clone();
                std::thread::spawn(move || {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            let _ = app_clone.emit("daemon-stdout", &line);
                            if let Ok(mut d) = state_clone.lock() {
                                if d.stdout_buffer.len() >= 100 {
                                    d.stdout_buffer.pop_front();
                                }
                                d.stdout_buffer.push_back(line);
                            }
                        }
                    }
                });
            }

            // Stream stderr
            if let Some(stderr) = child.stderr.take() {
                let state_clone = Arc::clone(state);
                let app_clone = app.clone();
                std::thread::spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            let _ = app_clone.emit("daemon-stderr", &line);
                            if let Ok(mut d) = state_clone.lock() {
                                if d.stderr_buffer.len() >= 100 {
                                    d.stderr_buffer.pop_front();
                                }
                                d.stderr_buffer.push_back(line);
                            }
                        }
                    }
                });
            }

            daemon.child = Some(child);
            let _ = app.emit("daemon-status", DaemonStatus::Running);

            // Spawn watchdog thread
            let state_clone = Arc::clone(state);
            let app_clone = app.clone();
            std::thread::spawn(move || {
                watchdog_loop(state_clone, app_clone);
            });

            Ok(())
        }
        Err(e) => {
            daemon.status = DaemonStatus::Crashed;
            let _ = app.emit("daemon-status", DaemonStatus::Crashed);
            Err(format!("Failed to spawn daemon: {}", e))
        }
    }
}

fn watchdog_loop(state: SharedDaemon, app: AppHandle) {
    loop {
        std::thread::sleep(Duration::from_secs(5));

        let should_restart = {
            let mut daemon = match state.lock() {
                Ok(d) => d,
                Err(_) => break,
            };

            if !daemon.should_run {
                break;
            }

            if let Some(ref mut child) = daemon.child {
                match child.try_wait() {
                    Ok(Some(_exit)) => {
                        // Process exited — mark crashed
                        daemon.status = DaemonStatus::Crashed;
                        daemon.crash_count += 1;
                        daemon.last_crash = Some(Instant::now());
                        daemon.child = None;
                        daemon.pid = None;
                        let _ = app.emit("daemon-status", DaemonStatus::Crashed);

                        // Send notification
                        let backoff = calculate_backoff(daemon.crash_count);
                        let _ = app.emit(
                            "daemon-crash",
                            format!("Daemon crashed (#{}) — restarting in {}s", daemon.crash_count, backoff),
                        );

                        true
                    }
                    Ok(None) => false, // Still running
                    Err(_) => false,
                }
            } else if daemon.status == DaemonStatus::Crashed && daemon.should_run {
                true
            } else {
                false
            }
        };

        if should_restart {
            let backoff = {
                let daemon = state.lock().unwrap();
                if !daemon.should_run {
                    break;
                }
                calculate_backoff(daemon.crash_count)
            };

            std::thread::sleep(Duration::from_secs(backoff));

            let should_run = state.lock().map(|d| d.should_run).unwrap_or(false);
            if !should_run {
                break;
            }

            let _ = spawn_daemon(&state, &app);
        }
    }
}

fn calculate_backoff(crash_count: u32) -> u64 {
    let base: u64 = 10;
    let backoff = base * 2u64.pow(crash_count.saturating_sub(1).min(5));
    backoff.min(300) // Max 5 minutes
}

pub fn stop_daemon(state: &SharedDaemon, app: &AppHandle) -> Result<(), String> {
    let mut daemon = state.lock().map_err(|e| e.to_string())?;
    daemon.should_run = false;

    if let Some(ref mut child) = daemon.child {
        // Try graceful shutdown first
        let _ = child.kill();
        let _ = child.wait();
    }

    daemon.child = None;
    daemon.pid = None;
    daemon.status = DaemonStatus::Stopped;
    let _ = app.emit("daemon-status", DaemonStatus::Stopped);
    Ok(())
}

pub fn restart_daemon(state: &SharedDaemon, app: &AppHandle) -> Result<(), String> {
    stop_daemon(state, app)?;
    std::thread::sleep(Duration::from_secs(1));
    {
        let mut daemon = state.lock().map_err(|e| e.to_string())?;
        daemon.should_run = true;
        daemon.crash_count = 0;
    }
    spawn_daemon(state, app)
}

pub fn get_status(state: &SharedDaemon) -> DaemonInfo {
    let daemon = state.lock().unwrap();
    DaemonInfo {
        status: daemon.status.clone(),
        pid: daemon.pid,
        uptime_seconds: daemon.start_time.map(|t| t.elapsed().as_secs()),
        crash_count: daemon.crash_count,
        recent_stdout: daemon.stdout_buffer.iter().cloned().collect(),
        recent_stderr: daemon.stderr_buffer.iter().cloned().collect(),
    }
}
