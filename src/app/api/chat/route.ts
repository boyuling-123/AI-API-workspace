import { NextResponse } from "next/server";
import { chatWithModel } from "@/services/llmClient";
import type { LlmChatParams } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: LlmChatParams;
  try {
    body = (await request.json()) as LlmChatParams;
  } catch {
    return NextResponse.json(
      { error: "请求体解析失败，需为合法 JSON" },
      { status: 400 }
    );
  }

  if (!body.baseModel?.baseUrl || !body.baseModel?.apiKey || !body.baseModel?.modelName) {
    return NextResponse.json(
      { error: "缺少基础大模型配置（baseUrl/apiKey/modelName）" },
      { status: 400 }
    );
  }
  if (!body.prompt) {
    return NextResponse.json(
      { error: "缺少必填参数 prompt" },
      { status: 400 }
    );
  }

  try {
    const result = await chatWithModel({
      baseModel: body.baseModel,
      prompt: body.prompt,
      images: body.images,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
