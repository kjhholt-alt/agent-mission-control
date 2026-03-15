import { NextRequest, NextResponse } from "next/server";

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

// Color constants (decimal)
const COLORS = {
  cyan: 0x06b6d4,
  emerald: 0x10b981,
  amber: 0xe8a019,
  red: 0xef4444,
  purple: 0x8b5cf6,
  orange: 0xf97316,
};

function buildEmbed(
  type: string,
  data: Record<string, string | number | undefined>
): DiscordEmbed {
  switch (type) {
    case "mission_spawned":
      return {
        title: "New Mission Spawned",
        description: `**${data.goal}**`,
        color: COLORS.cyan,
        fields: [
          { name: "Project", value: String(data.project || "general"), inline: true },
          { name: "Worker", value: String(data.worker_type || "auto"), inline: true },
          { name: "Priority", value: String(data.priority || 50), inline: true },
        ],
        footer: { text: "NEXUS" },
        timestamp: new Date().toISOString(),
      };

    case "mission_completed":
      return {
        title: "Mission Complete",
        description: `**${data.title}**`,
        color: COLORS.emerald,
        fields: [
          { name: "Project", value: String(data.project || "general"), inline: true },
          { name: "Duration", value: String(data.duration || "unknown"), inline: true },
        ],
        footer: { text: "NEXUS" },
        timestamp: new Date().toISOString(),
      };

    case "mission_failed":
      return {
        title: "Mission Failed",
        description: `**${data.title}**\n${data.error || "No error details"}`,
        color: COLORS.red,
        fields: [
          { name: "Project", value: String(data.project || "general"), inline: true },
        ],
        footer: { text: "NEXUS" },
        timestamp: new Date().toISOString(),
      };

    case "deploy_triggered":
      return {
        title: "Deploy Triggered",
        description: `Deploying **${data.project}** to **${data.target}**`,
        color: COLORS.orange,
        footer: { text: "NEXUS" },
        timestamp: new Date().toISOString(),
      };

    case "budget_alert":
      return {
        title: "Budget Alert",
        description: `Daily spend at **${data.percentage}%** ($${data.spent})`,
        color: COLORS.amber,
        footer: { text: "NEXUS" },
        timestamp: new Date().toISOString(),
      };

    case "session_summary":
      return {
        title: "Session Complete",
        description: `**${data.project}** session finished`,
        color: COLORS.purple,
        fields: [
          { name: "Model", value: String(data.model || "unknown"), inline: true },
          { name: "Tools", value: String(data.tools || 0), inline: true },
          { name: "Cost", value: `$${data.cost || "0.00"}`, inline: true },
        ],
        footer: { text: "NEXUS" },
        timestamp: new Date().toISOString(),
      };

    default:
      return {
        title: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: JSON.stringify(data, null, 2).slice(0, 1000),
        color: COLORS.cyan,
        footer: { text: "NEXUS" },
        timestamp: new Date().toISOString(),
      };
  }
}

/**
 * POST /api/discord/notify — Send a notification to Discord.
 * Body: { type: string, data: Record<string, any> }
 */
export async function POST(request: NextRequest) {
  try {
    if (!DISCORD_WEBHOOK_URL) {
      return NextResponse.json(
        { error: "DISCORD_WEBHOOK_URL not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { type, data } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Missing required field: type" },
        { status: 400 }
      );
    }

    const embed = buildEmbed(type, data || {});

    const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "NEXUS",
        embeds: [embed],
      }),
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      return NextResponse.json(
        { error: `Discord error: ${errText}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, type });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
