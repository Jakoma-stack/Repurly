import { NextRequest, NextResponse } from "next/server";
import { buildInstagramAuthUrl } from "@/lib/instagram/oauth";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  return NextResponse.redirect(buildInstagramAuthUrl(workspaceId));
}
