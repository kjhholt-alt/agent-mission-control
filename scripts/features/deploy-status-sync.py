"""Script 33: Check Vercel deployment status for key projects."""
import json, urllib.request, sys

PROJECTS = {
    "nexus": "nexus.buildkit.store",
    "buildkit-services": "services.buildkit.store",
    "ai-finance-brief": "ai-finance-brief.vercel.app",
    "pc-bottleneck-analyzer": "pcbottleneck.buildkit.store",
    "email-finder-app": "emailfinder.buildkit.store",
    "ai-chess-coach": "ai-chess-coach.vercel.app",
}

print(f"\n  === DEPLOY STATUS CHECK ===\n")

for project, domain in PROJECTS.items():
    try:
        req = urllib.request.Request(f"https://{domain}", method="HEAD")
        resp = urllib.request.urlopen(req, timeout=10)
        code = resp.getcode()
        server = resp.headers.get("server", "?")
        print(f"  UP    {project:30s}  https://{domain}  ({code}, {server})")
    except urllib.error.HTTPError as e:
        print(f"  WARN  {project:30s}  https://{domain}  (HTTP {e.code})")
    except Exception as e:
        print(f"  DOWN  {project:30s}  https://{domain}  ({e})")
