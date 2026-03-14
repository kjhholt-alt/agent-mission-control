"""
Nexus Tools MCP Server

Exposes Nexus tools (like video analysis) as MCP tools callable from any Claude Code session.

Usage:
    python tools/mcp_server.py

Configure in ~/.claude.json:
    "mcpServers": {
        "nexus-tools": {
            "command": "python",
            "args": ["C:/Users/Kruz/Desktop/Projects/nexus/tools/mcp_server.py"],
            "env": {
                "ANTHROPIC_API_KEY": "..."
            }
        }
    }
"""

import importlib.util
import json
import sys
from pathlib import Path

TOOLS_DIR = Path(__file__).parent


def load_twitter_video():
    """Dynamically import the twitter-video module."""
    spec = importlib.util.spec_from_file_location(
        "twitter_video", TOOLS_DIR / "twitter-video.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def handle_request(request: dict) -> dict:
    """Handle a JSON-RPC request."""
    method = request.get("method", "")
    req_id = request.get("id")
    params = request.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {
                    "name": "nexus-tools",
                    "version": "1.0.0",
                },
            },
        }

    if method == "notifications/initialized":
        return None  # No response for notifications

    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": [
                    {
                        "name": "analyze_video",
                        "description": (
                            "Download and analyze a Twitter/X video. "
                            "Extracts frames and uses Claude Vision to describe "
                            "what's shown: UI, product, features, design, etc."
                        ),
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "url": {
                                    "type": "string",
                                    "description": "Twitter/X URL (e.g. https://x.com/user/status/12345)",
                                },
                                "frames": {
                                    "type": "integer",
                                    "description": "Number of frames to extract (default: 8)",
                                    "default": 8,
                                },
                                "deep": {
                                    "type": "boolean",
                                    "description": "Use Sonnet instead of Haiku for deeper analysis",
                                    "default": False,
                                },
                            },
                            "required": ["url"],
                        },
                    }
                ]
            },
        }

    if method == "tools/call":
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})

        if tool_name == "analyze_video":
            try:
                mod = load_twitter_video()
                url = arguments.get("url", "")
                frames = arguments.get("frames", 8)
                deep = arguments.get("deep", False)
                model = (
                    "claude-sonnet-4-5-20250514"
                    if deep
                    else "claude-haiku-4-5-20251001"
                )

                result = mod.analyze_video(
                    url=url,
                    num_frames=frames,
                    model=model,
                    use_playwright=False,
                )

                text = (
                    f"## Video Analysis\n\n"
                    f"**URL:** {result['url']}\n"
                    f"**Author:** @{result['author']}\n"
                    f"**Title:** {result['title']}\n"
                    f"**Method:** {result['method']}\n\n"
                    f"---\n\n"
                    f"{result['analysis']}"
                )

                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": text}],
                        "isError": False,
                    },
                }
            except Exception as e:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": f"Error: {e}"}],
                        "isError": True,
                    },
                }

        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {"code": -32601, "message": f"Unknown tool: {tool_name}"},
        }

    # Unknown method
    if req_id is not None:
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {"code": -32601, "message": f"Unknown method: {method}"},
        }
    return None


def main():
    """Run the MCP server over stdio."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            continue

        response = handle_request(request)
        if response is not None:
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
