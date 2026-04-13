import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "Repurly-Quickstart-Guide.md");
  const buffer = await fs.readFile(filePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="Repurly-Quickstart-Guide.md"',
    },
  });
}
