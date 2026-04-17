import { NextRequest, NextResponse } from "next/server";
import { buildXAuthUrl } from "@/lib/x/oauth";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  return NextResponse.redirect(buildXAuthUrl(workspaceId));
}
