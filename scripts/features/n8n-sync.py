"""Script 40: Check n8n workflow status and sync with Nexus."""
import json, urllib.request

N8N_URL = "https://automation-playground-production.up.railway.app"
N8N_KEY = ""  # Set from .env

# Try loading from .env
import os
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env.local")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.startswith("N8N_API_KEY="):
                N8N_KEY = line.split("=", 1)[1].strip().strip('"')

if not N8N_KEY:
    print("  N8N_API_KEY not found in .env.local")
    print("  Set it to check n8n workflow status")
    exit(1)

req = urllib.request.Request(f"{N8N_URL}/api/v1/workflows",
    headers={"X-N8N-API-KEY": N8N_KEY})
try:
    workflows = json.loads(urllib.request.urlopen(req, timeout=10).read())
    data = workflows.get("data", workflows) if isinstance(workflows, dict) else workflows

    print(f"\n  === n8n WORKFLOWS ===\n")
    active = 0
    for wf in data:
        status = "ACTIVE" if wf.get("active") else "INACTIVE"
        name = wf.get("name", "?")
        wf_id = wf.get("id", "?")
        if wf.get("active"): active += 1
        print(f"  [{status:8s}]  {wf_id:20s}  {name}")

    print(f"\n  {active}/{len(data)} workflows active")
except Exception as e:
    print(f"  Error connecting to n8n: {e}")
