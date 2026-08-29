import { NextResponse } from "next/server";
import { generateDimensions } from "@/services/genDimensionsService";
import {
  DimensionGenerationValidationError,
  parseDimensionGenerationRequest,
} from "@/lib/dimensionGeneration";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AI 生成候选评价维度（v4.5）：用户描述测评需求 → 大模型生成若干候选维度（每个带说明）。
 * 内置预设维度集仅作为模型生成时的内部参考，不透出给用户。
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "请求体解析失败，需为合法 JSON" },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "请求体必须是对象" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  if (typeof raw.modelId !== "string" || !raw.modelId.trim()) {
    return NextResponse.json({ error: "缺少生成模型 modelId" }, { status: 400 });
  }
  if (raw.modelId.trim().length > 200) {
    return NextResponse.json({ error: "生成模型 modelId 过长" }, { status: 400 });
  }
  const modelId = raw.modelId.trim();

  let dimensionRequest;
  try {
    dimensionRequest = parseDimensionGenerationRequest(raw.request);
  } catch (error) {
    const message =
      error instanceof DimensionGenerationValidationError
        ? error.message
        : "维度生成请求校验失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const dimensions = await generateDimensions(dimensionRequest, modelId);
    return NextResponse.json({ dimensions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
