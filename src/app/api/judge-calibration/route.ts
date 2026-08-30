import { NextResponse } from "next/server";
import {
  JudgeCalibrationValidationError,
  judgeGoldenCase,
  parseJudgeCalibrationCriteria,
  parseJudgeCalibrationInput,
  parseJudgeCalibrationModelId,
} from "@/services/judgeCalibrationService";

export const runtime = "nodejs";
export const maxDuration = 60;

interface JudgeCalibrationBody {
  item?: unknown;
  modelId?: unknown;
  criteria?: unknown;
}

/** 一次只判断一条黄金 Case；并发与费用确认由前端校准 Runner 管理。 */
export async function POST(request: Request) {
  let body: JudgeCalibrationBody;
  try {
    body = (await request.json()) as JudgeCalibrationBody;
  } catch {
    return NextResponse.json(
      { error: "请求体解析失败，需为合法 JSON" },
      { status: 400 }
    );
  }

  try {
    const item = parseJudgeCalibrationInput(body.item);
    const modelId = parseJudgeCalibrationModelId(body.modelId);
    const criteria = parseJudgeCalibrationCriteria(body.criteria);
    const result = await judgeGoldenCase(item, modelId, criteria);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Judge 校准失败";
    return NextResponse.json(
      { error: message },
      { status: error instanceof JudgeCalibrationValidationError ? 400 : 500 }
    );
  }
}
