import { NextResponse } from "next/server";
import { generateTaskData } from "@/services/genDataService";
import type { BaseModelConfig, GenDataRequest } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenDataBody {
  request: GenDataRequest;
  /** v4.8：前端传入的基础大模型配置（baseUrl + apiKey 明文 + modelName）。 */
  baseModel: BaseModelConfig;
}

/**
 * AI 造数据路由（v4.8）：按 GenDataRequest 调用前端传入的基础大模型生成测评输入，
 * 返回归一化的 TaskInput[]，供前端灌入批量输入区。不再读 process.env。
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

  if (!body.baseModel) {
    return NextResponse.json(
      { ok: false, error: "缺少基础大模型配置，请先在「接口与模型管理」接入并选择一个基础大模型" },
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
    const items = await generateTaskData(body.request, body.baseModel);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ ok: false, error: message });
  }
}
