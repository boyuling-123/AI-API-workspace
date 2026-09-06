import { NextResponse } from "next/server";
import { assertLocalArchiveRequest } from "@/server/localArchiveAccess";
import { executePlatformAction, PlatformActionError, safeActionError } from "@/server/platformActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Cross-Origin-Resource-Policy": "same-origin", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  try {
    assertLocalArchiveRequest(request);
    const params = new URL(request.url).searchParams;
    if (params.toString().length > 128 || Array.from(params.keys()).some((key) => key !== "action") || params.getAll("action").length !== 1) {
      throw new PlatformActionError("INVALID_ACTION", 400);
    }
    const data = await executePlatformAction({ name: params.get("action"), arguments: {} });
    return NextResponse.json({ ok: true, data }, { headers });
  } catch (reason) {
    const error = safeActionError(reason);
    return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status, headers });
  }
}
