import type { ApiDocParseResult, BaseModelConfig } from "@/types";
import { chatWithModel } from "@/services/llmClient";

/**
 * AI 解读任意目标文档（服务端，v4 统一接入）：复用 DashScope 大模型，强制结构化 JSON 输出，
 * 容错解析为 ApiDocParseResult。只透出解读结果填进接入表单，全字段可手动改。
 */

const PARSE_SYSTEM_GUIDE = `你是一个 API 对接助手。请阅读用户提供的 API 对接文档/文本，提取接入所需的关键信息，并严格只输出一个 JSON 对象（不要任何解释、不要 markdown 代码块标记）。

JSON 字段说明：
- contentKind: "text" | "multimodal" | "image"。纯文本/对话类填 "text"；能看图（图片输入）且输出文字的多模态理解模型填 "multimodal"；输出图片的生图类填 "image"。注意：多模态理解（看图出文字）一律填 "multimodal"，不要填 "image"。
- endpoint: 接口完整 URL（字符串，未知则省略）。
- method: "GET" 或 "POST"（未知则省略）。
- authType: 鉴权方式的简短描述，如 "Bearer Token"、"API Key in Header"、"无鉴权"。
- suggestedKeyRef: 建议的环境变量引用名（大写下划线风格，如 "MY_API_KEY"）；无鉴权则省略。
- requestParams: 数组，每项 { name, type, required, desc }。type 仅能是 "string"|"number"|"boolean"|"image"；required 为布尔；desc 为中文简短说明。
- bodyTemplate: 请求体 JSON 模板（字符串），参数位置用 {{参数名}} 占位，如 {"prompt":"{{prompt}}"}；未知则省略。
- preprocess: 字符串数组，声明所需安全能力，仅能取自：["md5_sign","hmac_sha256","timestamp","two_step_auth","image_as_url","image_as_base64"]；不需要则空数组。
- outputTextPath: 响应里文本结果的字段路径（点号风格，如 "data.caption"），未知则省略。
- outputImagePath: 响应里图片结果的字段路径（如 "data.images"），未知则省略。
- summary: 一句话中文总结该接口用途。
- warnings: 字符串数组，列出你不确定或需要用户人工核对的点；没有则空数组。

只输出 JSON 对象本身。`;

function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function coerceContentKind(value: unknown): "text" | "multimodal" | "image" {
  if (value === "multimodal") return "multimodal";
  if (value === "image") return "image";
  // 兼容历史/误填的 "both"：按多模态理解处理（看图+出文字）。
  if (value === "both") return "multimodal";
  return "text";
}

function coerceParamType(
  value: unknown
): "string" | "number" | "boolean" | "image" {
  if (value === "number" || value === "boolean" || value === "image") {
    return value;
  }
  return "string";
}

function normalizeResult(raw: unknown): ApiDocParseResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rawParams = Array.isArray(obj.requestParams) ? obj.requestParams : [];

  return {
    contentKind: coerceContentKind(obj.contentKind),
    endpoint: typeof obj.endpoint === "string" ? obj.endpoint : undefined,
    method: obj.method === "GET" ? "GET" : obj.method === "POST" ? "POST" : undefined,
    authType: typeof obj.authType === "string" ? obj.authType : undefined,
    suggestedKeyRef:
      typeof obj.suggestedKeyRef === "string" ? obj.suggestedKeyRef : undefined,
    bodyTemplate:
      typeof obj.bodyTemplate === "string" ? obj.bodyTemplate : undefined,
    preprocess: Array.isArray(obj.preprocess)
      ? obj.preprocess.filter((p): p is string => typeof p === "string")
      : undefined,
    requestParams: rawParams.map((item) => {
      const param = (item ?? {}) as Record<string, unknown>;
      return {
        name: typeof param.name === "string" ? param.name : "",
        type: coerceParamType(param.type),
        required: Boolean(param.required),
        desc: typeof param.desc === "string" ? param.desc : undefined,
      };
    }),
    outputTextPath:
      typeof obj.outputTextPath === "string" ? obj.outputTextPath : undefined,
    outputImagePath:
      typeof obj.outputImagePath === "string" ? obj.outputImagePath : undefined,
    summary: typeof obj.summary === "string" ? obj.summary : "",
    warnings: Array.isArray(obj.warnings)
      ? obj.warnings.filter((w): w is string => typeof w === "string")
      : [],
  };
}

export async function parseApiDoc(
  doc: string,
  baseModel: BaseModelConfig
): Promise<ApiDocParseResult> {
  const prompt = `${PARSE_SYSTEM_GUIDE}\n\n=== API 对接文档开始 ===\n${doc}\n=== API 对接文档结束 ===`;

  const output = await chatWithModel({ baseModel, prompt });
  const jsonText = extractJsonBlock(output.outputText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(
      "AI 返回内容无法解析为 JSON，请重试或更换解读模型。原始返回片段：" +
        output.outputText.slice(0, 200)
    );
  }

  return normalizeResult(parsed);
}
