import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPresignedUpload } from "@/lib/storage/presign";

export const runtime = "nodejs";

const schema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  workspaceId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { fileName, contentType, workspaceId } = parsed.data;
    const objectKey = `${workspaceId}/${Date.now()}-${fileName}`;
    const result = await createPresignedUpload(objectKey, contentType);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to create presigned upload", error);
    return NextResponse.json(
      { error: "Failed to create presigned upload" },
      { status: 500 },
    );
  }
}
