import { NextResponse } from "next/server";
import { generateDimensions } from "@/services/genDimensionsService";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenDimensionsBody {
  userRequirement: string;
  modelId: string;
}

/**
 * AI 生成候选评价维度（v4.5）：用户描述测评需求 → 大模型生成若干候选维度（每个带说明）。
 * 内置预设维度集仅作为模型生成时的内部参考，不透出给用户。
 */
export async function POST(request: Request) {
  let body: GenDimensionsBody;
  try {
    body = (await request.json()) as GenDimensionsBody;
  } catch {
    return NextResponse.json(
      { error: "请求体解析失败，需为合法 JSON" },
      { status: 400 }
    );
  }

  if (!body.userRequirement?.trim()) {
    return NextResponse.json({ error: "请描述测评需求" }, { status: 400 });
  }
  if (!body.modelId) {
    return NextResponse.json({ error: "缺少生成模型 modelId" }, { status: 400 });
  }

  try {
    const dimensions = await generateDimensions(
      body.userRequirement,
      body.modelId
    );
    return NextResponse.json({ dimensions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
