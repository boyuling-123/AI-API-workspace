import { NextResponse } from "next/server";
import { runTarget } from "@/adapters/registry";
import type { TargetConfig } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface TestApiBody {
  target: TargetConfig;
  paramValues: Record<string, unknown>;
}

/**
 * 接入连通性测试路由（M8）：走统一执行入口 runTarget，与真实运行**同一条链路**
 * （含方案 B 安全能力 preprocess 注入、鉴权注入、输出按 path 提取归一化），
 * 保证「测试什么就跑什么」——勾选的安全能力在测试阶段就被真实注入，避免测试通过但运行失败。
 *
 * 供接入表单的「测试」按钮判定 tested_ok / tested_fail，并回传诊断信息（耗时、提取结果）。
 */
export async function POST(request: Request) {
  let body: TestApiBody;
  try {
    body = (await request.json()) as TestApiBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求体解析失败，需为合法 JSON" },
      { status: 400 }
    );
  }

  if (!body.target?.id) {
    return NextResponse.json(
      { ok: false, error: "缺少 target 配置" },
      { status: 400 }
    );
  }
  if (body.target.type !== "comfyui" && !body.target.requestTemplate?.url) {
    return NextResponse.json(
      { ok: false, error: "缺少 requestTemplate.url" },
      { status: 400 }
    );
  }

  const paramValues = body.paramValues ?? {};
  const prompt = String(paramValues.prompt ?? "测试连通性");

  try {
    const result = await runTarget(body.target, {
      prompt,
      paramValues,
      baseOrigin: new URL(request.url).origin,
    });

    return NextResponse.json({
      ok: true,
      outputText: result.outputText,
      outputImages: result.outputImages,
      latencyMs: result.latencyMs,
      extractedTextOk: Boolean(result.outputText),
      extractedImageCount: result.outputImages.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ ok: false, error: message });
  }
}
