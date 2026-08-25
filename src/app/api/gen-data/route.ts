import { NextResponse } from "next/server";
import { generateTaskData } from "@/services/genDataService";
import type { GenDataRequest } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenDataBody {
  request: GenDataRequest;
  modelId: string;
}

/**
 * AI 造数据路由（M10）：按 GenDataRequest（contentMode/shape/count/requirement/targetColumns）
 * 调用大模型生成测评输入，返回归一化的 TaskInput[]，供前端灌入批量输入区。
 */
export async function POST(request: Request) {
  let body: GenDataBody;
  try {
    body = (await request.json()) as GenDataBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求体解析失败，需为合法 JSON" },
      { status: 400 }
    );
  }

  if (!body.modelId) {
    return NextResponse.json(
      { ok: false, error: "缺少造数据模型 modelId" },
      { status: 400 }
    );
  }
  if (!body.request?.requirement?.trim()) {
    return NextResponse.json(
      { ok: false, error: "请填写数据需求描述" },
      { status: 400 }
    );
  }

  try {
    const items = await generateTaskData(body.request, body.modelId);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ ok: false, error: message });
  }
}
