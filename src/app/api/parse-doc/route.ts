import { NextResponse } from "next/server";
import type { BaseModelConfig } from "@/types";
import { parseApiDoc } from "@/services/parseDocService";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ParseDocBody {
  doc: string;
  /** v4.8：前端传入的基础大模型配置（baseUrl + apiKey 明文 + modelName）。 */
  baseModel: BaseModelConfig;
}

/**
 * AI 解读 API 文档（v4.8）：接收前端传入的基础大模型配置，调用大模型结构化解读文档。
 * 不再读 process.env，不再依赖写死的 modelId。
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
  if (!body.baseModel) {
    return NextResponse.json(
      { error: "缺少基础大模型配置，请先在「接口与模型管理」接入并选择一个基础大模型" },
      { status: 400 }
    );
  }

  try {
    const result = await parseApiDoc(body.doc, body.baseModel);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
