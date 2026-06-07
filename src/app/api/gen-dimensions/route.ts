import { NextResponse } from "next/server";
import type { BaseModelConfig } from "@/types";
import { generateDimensions } from "@/services/genDimensionsService";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenDimensionsBody {
  userRequirement: string;
  /** v4.8：前端传入的基础大模型配置（baseUrl + apiKey 明文 + modelName）。 */
  baseModel: BaseModelConfig;
}

/**
 * AI 生成候选评价维度（v4.8）：用户描述测评需求 → 用前端传入的基础大模型生成若干候选维度。
 * 内置预设维度集仅作为模型生成时的内部参考，不透出给用户。不再读 process.env。
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
  if (!body.baseModel) {
    return NextResponse.json(
      { error: "缺少基础大模型配置，请先在「接口与模型管理」接入并选择一个基础大模型" },
      { status: 400 }
    );
  }

  try {
    const dimensions = await generateDimensions(
      body.userRequirement,
      body.baseModel
    );
    return NextResponse.json({ dimensions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
