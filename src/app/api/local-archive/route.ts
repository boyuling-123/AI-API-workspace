import { NextResponse } from "next/server";
import { ArchiveError } from "@/server/localArchiveReader";
import { readArchiveRequest } from "@/server/localArchiveAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Cross-Origin-Resource-Policy": "same-origin", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  try {
    return NextResponse.json({ ok: true, data: await readArchiveRequest(request) }, { headers });
  } catch (error) {
    // Filesystem exceptions can contain private paths. Do not log or serialize the original error.
    return NextResponse.json({ ok: false, code: error instanceof ArchiveError ? error.code : "ARCHIVE_UNAVAILABLE",
      error: error instanceof ArchiveError ? error.message : "无法读取本地归档。请核对目录、文件格式与访问权限。" },
    { status: error instanceof ArchiveError ? error.status : 503, headers });
  }
}
