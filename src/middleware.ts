import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Skip auth for non-API routes (pages)
  if (!request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  // GET requests are always public (dashboard reads)
  if (request.method === "GET") return NextResponse.next();

  // Public POST endpoints (no auth required)
  const publicPosts = [
    "/api/agents/seed",
    "/api/collector/event",   // Claude Code hooks need this
    "/api/heartbeat",         // Agent heartbeats
    "/api/oracle",
    "/api/oracle/chat",
    "/api/oracle/decisions",
  ];
  if (publicPosts.some((p) => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // All other POST/PUT/DELETE require API key
  const apiKey =
    request.headers.get("x-nexus-key") ||
    request.headers.get("authorization")?.replace("Bearer ", "");
  const validKey = process.env.NEXUS_API_KEY || "nexus-hive-2026";

  if (apiKey !== validKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
