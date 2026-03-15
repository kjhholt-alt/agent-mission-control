#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# Nexus Hook Setup — Configures Claude Code to send events to Nexus
# ══════════════════════════════════════════════════════════════════════
#
# This script adds hooks to your Claude Code settings so that every
# tool use event gets sent to the Nexus collector. Events are sent
# asynchronously and won't slow down your Claude Code sessions.
#
# Usage:
#   bash scripts/setup-hooks.sh
#   bash scripts/setup-hooks.sh --url https://nexus.buildkit.store
#
# Default URL: http://localhost:3000

NEXUS_URL="${1:-http://localhost:3000}"

# Remove --url prefix if passed
if [ "$NEXUS_URL" = "--url" ]; then
  NEXUS_URL="${2:-http://localhost:3000}"
fi

SETTINGS_DIR="$HOME/.claude"
SETTINGS_FILE="$SETTINGS_DIR/settings.json"

echo "╔══════════════════════════════════════════╗"
echo "║     NEXUS — Hook Setup                   ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Collector URL: $NEXUS_URL/api/collector/event"
echo ""

# Create settings dir if needed
mkdir -p "$SETTINGS_DIR"

# Build the hook command
# The hook receives event data via environment variables
HOOK_CMD="curl -s -X POST ${NEXUS_URL}/api/collector/event -H 'Content-Type: application/json' -d '{\"session_id\": \"'\$CLAUDE_SESSION_ID'\", \"event_type\": \"'\$CLAUDE_HOOK_EVENT_TYPE'\", \"tool_name\": \"'\$CLAUDE_TOOL_NAME'\", \"workspace_path\": \"'\$CLAUDE_WORKSPACE_PATH'\", \"model\": \"'\$CLAUDE_MODEL'\"}' > /dev/null 2>&1 &"

# Check if settings file exists
if [ -f "$SETTINGS_FILE" ]; then
  echo "Found existing settings at: $SETTINGS_FILE"
  echo ""
  echo "Add the following to your hooks configuration manually:"
else
  echo "No settings file found at: $SETTINGS_FILE"
  echo ""
  echo "Create the file with the following content:"
fi

echo ""
echo "─────────────────────────────────────────────"
cat << 'HOOKEOF'
Add to ~/.claude/settings.json under "hooks":

{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
HOOKEOF
echo "            \"type\": \"command\","
echo "            \"command\": \"curl -s -X POST ${NEXUS_URL}/api/collector/event -H 'Content-Type: application/json' -d '{\\\"session_id\\\": \\\"'\$CLAUDE_SESSION_ID'\\\", \\\"event_type\\\": \\\"PreToolUse\\\", \\\"tool_name\\\": \\\"'\$CLAUDE_TOOL_NAME'\\\", \\\"workspace_path\\\": \\\"'\$CLAUDE_WORKSPACE_PATH'\\\"}' > /dev/null 2>&1 &\""
cat << 'HOOKEOF'
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
HOOKEOF
echo "            \"type\": \"command\","
echo "            \"command\": \"curl -s -X POST ${NEXUS_URL}/api/collector/event -H 'Content-Type: application/json' -d '{\\\"session_id\\\": \\\"'\$CLAUDE_SESSION_ID'\\\", \\\"event_type\\\": \\\"PostToolUse\\\", \\\"tool_name\\\": \\\"'\$CLAUDE_TOOL_NAME'\\\", \\\"workspace_path\\\": \\\"'\$CLAUDE_WORKSPACE_PATH'\\\"}' > /dev/null 2>&1 &\""
cat << 'HOOKEOF'
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
HOOKEOF
echo "            \"type\": \"command\","
echo "            \"command\": \"curl -s -X POST ${NEXUS_URL}/api/collector/event -H 'Content-Type: application/json' -d '{\\\"session_id\\\": \\\"'\$CLAUDE_SESSION_ID'\\\", \\\"event_type\\\": \\\"Stop\\\", \\\"workspace_path\\\": \\\"'\$CLAUDE_WORKSPACE_PATH'\\\"}' > /dev/null 2>&1 &\""
cat << 'HOOKEOF'
          }
        ]
      }
    ]
  }
}
HOOKEOF
echo "─────────────────────────────────────────────"
echo ""
echo "Done! After adding hooks, restart Claude Code for them to take effect."
echo "Test with: curl -X POST ${NEXUS_URL}/api/collector/event -H 'Content-Type: application/json' -d '{\"session_id\": \"test-123\", \"event_type\": \"PreToolUse\", \"tool_name\": \"Read\"}'"
