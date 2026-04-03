import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPresignedUpload } from "@/lib/storage/presign";

const schema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  workspaceId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const input = schema.parse(await request.json());
  const objectKey = `${input.workspaceId}/${Date.now()}-${input.fileName}`;
  const result = await createPresignedUpload(objectKey, input.contentType);
  return NextResponse.json(result);
}
