import { NextResponse } from "next/server";
import { parseApiDoc } from "@/services/parseDocService";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ParseDocBody {
  doc: string;
  modelId: string;
}

/**
 * AI 解读 API 文档（简化版，M8b）：只返回结构化解读结果用于展示，不回写 ApiConfig。
 * 解读复用 DashScope 网关大模型（DeepSeek/Kimi），不额外配 key。
 */
export async function POST(request: Request) {
  let body: ParseDocBody;
  try {
    body = (await request.json()) as ParseDocBody;
  } catch {
    return NextResponse.json(
      { error: "请求体解析失败，需为合法 JSON" },
      { status: 400 }
    );
  }

  if (!body.doc?.trim()) {
    return NextResponse.json({ error: "请粘贴 API 对接文档内容" }, { status: 400 });
  }
  if (!body.modelId) {
    return NextResponse.json({ error: "缺少解读模型 modelId" }, { status: 400 });
  }

  try {
    const result = await parseApiDoc(body.doc, body.modelId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
