import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Skip auth for public pages
  if (!request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  // Skip auth for specific public endpoints
  const publicPaths = ["/api/agents/seed"];
  if (publicPaths.includes(request.nextUrl.pathname)) return NextResponse.next();

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
