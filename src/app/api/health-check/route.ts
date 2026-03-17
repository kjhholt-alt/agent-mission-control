import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ServiceCheck {
  name: string;
  url: string;
  status: "healthy" | "degraded" | "down";
  response_time_ms: number;
  last_checked: string;
  error?: string;
}

const SERVICES = [
  { name: "Nexus", url: "https://nexus.buildkit.store" },
  { name: "PC Bottleneck Analyzer", url: "https://pcbottleneck.buildkit.store" },
  { name: "AI Finance Brief", url: "https://ai-finance-brief.vercel.app" },
  { name: "BuildKit Services", url: "https://services.buildkit.store" },
  { name: "Email Finder API", url: "https://emailfinder.buildkit.store" },
  { name: "BarrelHouse CRM", url: "https://barrelhouse-crm.vercel.app" },
];

async function checkService(service: { name: string; url: string }): Promise<ServiceCheck> {
  const startTime = Date.now();
  const lastChecked = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(service.url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "Nexus-Health-Check/1.0",
      },
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    let status: "healthy" | "degraded" | "down" = "healthy";
    if (response.status >= 500) {
      status = "down";
    } else if (response.status >= 400 || responseTime > 3000) {
      status = "degraded";
    }

    return {
      name: service.name,
      url: service.url,
      status,
      response_time_ms: responseTime,
      last_checked: lastChecked,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      name: service.name,
      url: service.url,
      status: "down",
      response_time_ms: responseTime,
      last_checked: lastChecked,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function GET() {
  try {
    // Check all services in parallel
    const checks = await Promise.all(SERVICES.map(checkService));

    // Store results in Supabase
    const { error: insertError } = await supabase
      .from("health_checks")
      .insert(
        checks.map((check) => ({
          service_name: check.name,
          service_url: check.url,
          status: check.status,
          response_time_ms: check.response_time_ms,
          error_message: check.error || null,
          checked_at: check.last_checked,
        }))
      );

    if (insertError) {
      console.error("Failed to store health checks:", insertError);
    }

    // Calculate overall health
    const healthyCount = checks.filter((c) => c.status === "healthy").length;
    const degradedCount = checks.filter((c) => c.status === "degraded").length;
    const downCount = checks.filter((c) => c.status === "down").length;

    return NextResponse.json({
      overall_status:
        downCount > 0 ? "critical" : degradedCount > 0 ? "warning" : "healthy",
      summary: {
        total: checks.length,
        healthy: healthyCount,
        degraded: degradedCount,
        down: downCount,
      },
      services: checks,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
