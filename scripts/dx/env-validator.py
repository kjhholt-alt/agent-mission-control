"""Script 49: Check all required env vars are set and test each connection."""
import os, json, urllib.request

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env.local")

REQUIRED = {
    "NEXT_PUBLIC_SUPABASE_URL": "Supabase project URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "Supabase anon key",
}

OPTIONAL = {
    "ANTHROPIC_API_KEY": "Claude API key",
    "NEXUS_API_KEY": "Nexus API auth key",
    "DISCORD_WEBHOOK_URL": "Discord notifications",
}

# Load .env.local
env_vars = {}
if os.path.exists(ENV_PATH):
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                env_vars[key.strip()] = val.strip().strip('"').strip("'")

print(f"\n  === ENV VALIDATOR ===\n")
print(f"  File: {ENV_PATH}")
print(f"  Vars found: {len(env_vars)}\n")

errors = 0

print("  --- Required ---")
for key, desc in REQUIRED.items():
    val = env_vars.get(key) or os.environ.get(key)
    if val:
        masked = val[:8] + "..." + val[-4:] if len(val) > 16 else val[:4] + "..."
        print(f"  PASS  {key:35s}  {masked}")
    else:
        print(f"  FAIL  {key:35s}  NOT SET — {desc}")
        errors += 1

print("\n  --- Optional ---")
for key, desc in OPTIONAL.items():
    val = env_vars.get(key) or os.environ.get(key)
    if val:
        masked = val[:8] + "..." if len(val) > 12 else val[:4] + "..."
        print(f"  SET   {key:35s}  {masked}")
    else:
        print(f"  SKIP  {key:35s}  not set — {desc}")

# Test Supabase connection
sb_url = env_vars.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
sb_key = env_vars.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
if sb_url and sb_key:
    print("\n  --- Connection Tests ---")
    try:
        req = urllib.request.Request(f"{sb_url}/rest/v1/nexus_sessions?limit=1",
            headers={"apikey": sb_key, "Authorization": f"Bearer {sb_key}"})
        urllib.request.urlopen(req, timeout=5)
        print(f"  PASS  Supabase connection")
    except Exception as e:
        print(f"  FAIL  Supabase connection: {e}")
        errors += 1

if errors:
    print(f"\n  {errors} errors found — fix before running Nexus")
else:
    print(f"\n  All checks passed")
