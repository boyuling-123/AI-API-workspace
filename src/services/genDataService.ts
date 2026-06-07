import type { BaseModelConfig, GenDataRequest, TaskInput } from "@/types";
import { generateId } from "@/lib/id";
import { chatWithModel } from "@/services/llmClient";

/**
 * AI 造数据服务（服务端，v4 M10）：复用 DashScope 大模型，强制结构化 JSON 输出，
 * 容错解析为 TaskInput[]。两形式：
 *  - one    造一条（返回 1 条）
 *  - batch  造批量数据（返回 count 条，列齐全的成套数据）
 *
 * 产出统一为 TaskInput[]（{prompt, images, extraFields}），可直接灌入批量输入区。
 */

function buildSystemGuide(request: GenDataRequest): string {
  const wantImage = request.contentMode === "image";
  const columnsHint =
    request.targetColumns.length > 0
      ? `\n目标当前需要的列（请尽量为每条数据填齐这些字段，放进 extraFields，prompt/image_url 除外）：${request.targetColumns.join(
          "、"
        )}。`
      : "";

  return `你是一个测评数据生成助手。请根据用户需求生成测评输入数据，严格只输出一个 JSON 数组（不要任何解释、不要 markdown 代码块标记）。

数组每一项是一条测评输入，结构：
- prompt: 字符串，本条数据的主提示词/${wantImage ? "生图描述" : "对话内容"}（必填）。
- ${wantImage ? 'image_url: 可选字符串，若该条需要参考图可给一个占位 URL；不需要则省略。' : "（文本场景无需图片字段）"}
- extraFields: 可选对象，放该条数据的其它列字段（键为列名，值为字符串/数字）。${columnsHint}

要求：
- 数据要贴合用户描述的业务场景，内容真实、可读、多样化（不要雷同）。
- 严格输出 JSON 数组本身，不要包裹对象、不要解释。`;
}

function targetCount(request: GenDataRequest): number {
  if (request.shape === "one") return 1;
  const count = request.count ?? 5;
  return Math.min(Math.max(count, 1), 50);
}

function extractJsonArray(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1);
  }
  return trimmed;
}

/** 把 AI 返回的单项归一化为 TaskInput（容错：缺字段给默认，多余字段进 extraFields）。 */
function normalizeItem(raw: unknown, wantImage: boolean): TaskInput {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const prompt = typeof obj.prompt === "string" ? obj.prompt : "";

  const images =
    wantImage && typeof obj.image_url === "string" && obj.image_url
      ? [
          {
            id: generateId(),
            name: "ai-gen",
            source: "url" as const,
            value: obj.image_url,
          },
        ]
      : [];

  const extraFields: Record<string, unknown> = {};
  const rawExtra = obj.extraFields;
  if (rawExtra && typeof rawExtra === "object" && !Array.isArray(rawExtra)) {
    Object.assign(extraFields, rawExtra as Record<string, unknown>);
  }

  return {
    id: generateId(),
    prompt,
    images,
    extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
  };
}

/**
 * 生成测评数据。返回 TaskInput[]，由调用方灌入批量输入区。
 */
export async function generateTaskData(
  request: GenDataRequest,
  baseModel: BaseModelConfig
): Promise<TaskInput[]> {
  const count = targetCount(request);
  const guide = buildSystemGuide(request);
  const prompt = `${guide}\n\n=== 用户需求 ===\n${request.requirement}\n\n请生成恰好 ${count} 条数据，输出 JSON 数组。`;

  const output = await chatWithModel({ baseModel, prompt });
  const jsonText = extractJsonArray(output.outputText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(
      "AI 返回内容无法解析为 JSON 数组，请重试或更换造数据模型。原始返回片段：" +
        output.outputText.slice(0, 200)
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI 未返回 JSON 数组，请重试。");
  }

  const wantImage = request.contentMode === "image";
  const items = parsed
    .map((item) => normalizeItem(item, wantImage))
    .filter((item) => item.prompt.trim().length > 0);

  if (items.length === 0) {
    throw new Error("AI 未生成有效数据（prompt 全为空），请调整需求后重试。");
  }

  return request.shape === "one" ? items.slice(0, 1) : items.slice(0, count);
}
