import type {
  AgentStreamEvent,
  AgentToolName,
  BaseModelConfig,
  ContentKind,
  ParamDef,
  PendingTarget,
} from "@/types";
import {
  AGENT_CONFIG,
  AGENT_SYSTEM_PROMPT,
  AGENT_TOOLS,
} from "@/config/agent";
import {
  buildAnthropicMessagesUrl,
  buildOpenAIChatCompletionsUrl,
  getBaseModelProtocolOrder,
  normalizeBaseModelConfig,
  parseJsonResponse,
  type ResolvedBaseModelProtocol,
  withResolvedProtocol,
} from "@/adapters/baseModelProtocol";
import { runScript } from "@/services/script/runScriptService";
import { installPackages } from "@/services/script/installPackageService";

/**
 * Agent 自动接入循环（v4.4 核心）。
 *
 * 支持 Anthropic / OpenAI 两套工具调用协议：
 *  - 会话启动时按 baseModel.protocol 与 baseUrl 自动探测可用协议
 *  - 探测成功后整轮会话锁定该协议，不在中途切换
 *  - 后端统一把 tool use / tool calls 归一化为同一套内部消息结构
 *
 * 每步通过 emit 回调把 AgentStreamEvent 推给上层（路由再转 SSE）。
 * 工具执行层统一保障安全约束（stdin 传参、超时杀进程、key 注入），复用 runScript / installPackages。
 */

// ===== Anthropic 消息结构（仅取所需字段）=====
interface AnthropicTextBlock {
  type: "text";
  text: string;
}
interface AnthropicThinkingBlock {
  type: "thinking";
  thinking?: string;
}
interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicThinkingBlock
  | AnthropicToolUseBlock
  | { type: string; [key: string]: unknown };

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  error?: { message?: string };
  message?: string;
}

interface OpenAITextPart {
  type?: string;
  text?: string;
}

interface OpenAIToolCall {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface OpenAIResponse {
  choices?: {
    message?: {
      content?: string | OpenAITextPart[];
      tool_calls?: OpenAIToolCall[];
    };
  }[];
  error?: { message?: string };
  message?: string;
}

interface AgentToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** 喂回模型的 tool_result block。 */
interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

type AgentMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: {
        text: string;
        toolUses: AgentToolUse[];
      };
    }
  | { role: "tool"; content: ToolResultBlock[] };

interface AgentModelResponse {
  protocolUsed: ResolvedBaseModelProtocol;
  text: string;
  toolUses: AgentToolUse[];
}

type EmitFn = (event: AgentStreamEvent) => void;

/** 调一次基础大模型（按 baseModel.protocol / baseUrl 自动探测协议并返回归一化结果）。 */
async function callAgentModel(
  baseModel: BaseModelConfig,
  messages: AgentMessage[]
): Promise<AgentModelResponse> {
  const normalized = normalizeBaseModelConfig(baseModel);
  const errors: string[] = [];

  for (const protocol of getBaseModelProtocolOrder(normalized)) {
    try {
      return protocol === "openai"
        ? await callOpenAIAgentModel(
            withResolvedProtocol(normalized, protocol),
            messages
          )
        : await callAnthropicAgentModel(
            withResolvedProtocol(normalized, protocol),
            messages
          );
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      errors.push(`${protocolLabel(protocol)} 调用失败：${message}`);
    }
  }

  throw new Error(errors.join("；"));
}

async function callAnthropicAgentModel(
  baseModel: BaseModelConfig,
  messages: AgentMessage[]
): Promise<AgentModelResponse> {
  const response = await fetch(buildAnthropicMessagesUrl(baseModel.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": baseModel.apiKey,
      Authorization: `Bearer ${baseModel.apiKey}`,
    },
    body: JSON.stringify({
      model: baseModel.modelName,
      max_tokens: AGENT_CONFIG.maxTokens,
      system: AGENT_SYSTEM_PROMPT,
      tools: AGENT_TOOLS,
      messages: toAnthropicMessages(messages),
    }),
  });

  const data = await parseJsonResponse<AnthropicResponse>(response, "Anthropic");
  if (!response.ok) {
    const message = data.error?.message ?? data.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  const blocks = data.content ?? [];
  return {
    protocolUsed: "anthropic",
    text: extractAnthropicText(blocks),
    toolUses: blocks
      .filter((block): block is AnthropicToolUseBlock => block.type === "tool_use")
      .map((block) => ({
        id: block.id,
        name: block.name,
        input: block.input,
      })),
  };
}

async function callOpenAIAgentModel(
  baseModel: BaseModelConfig,
  messages: AgentMessage[]
): Promise<AgentModelResponse> {
  const response = await fetch(buildOpenAIChatCompletionsUrl(baseModel.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${baseModel.apiKey}`,
      "x-api-key": baseModel.apiKey,
    },
    body: JSON.stringify({
      model: baseModel.modelName,
      max_tokens: AGENT_CONFIG.maxTokens,
      messages: toOpenAIMessages(messages),
      tools: toOpenAITools(),
      tool_choice: "auto",
    }),
  });

  const data = await parseJsonResponse<OpenAIResponse>(response, "OpenAI");
  if (!response.ok) {
    const message = data.error?.message ?? data.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  const message = data.choices?.[0]?.message;
  const toolUses = (message?.tool_calls ?? []).map((toolCall) => ({
    id: toolCall.id ?? `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: toolCall.function?.name ?? "unknown_tool",
    input: parseToolArguments(toolCall.function?.arguments),
  }));

  return {
    protocolUsed: "openai",
    text: extractOpenAIText(message?.content),
    toolUses,
  };
}

function toAnthropicMessages(messages: AgentMessage[]): Array<Record<string, unknown>> {
  return messages.map((message) => {
    if (message.role === "user") {
      return { role: "user", content: message.content };
    }
    if (message.role === "tool") {
      return { role: "user", content: message.content };
    }
    const content: AnthropicContentBlock[] = [];
    if (message.content.text.trim()) {
      content.push({ type: "text", text: message.content.text });
    }
    content.push(
      ...message.content.toolUses.map<AnthropicToolUseBlock>((toolUse) => ({
        type: "tool_use",
        id: toolUse.id,
        name: toolUse.name,
        input: toolUse.input,
      }))
    );
    return { role: "assistant", content };
  });
}

function toOpenAIMessages(messages: AgentMessage[]): Array<Record<string, unknown>> {
  const payload: Array<Record<string, unknown>> = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
  ];

  for (const message of messages) {
    if (message.role === "user") {
      payload.push({ role: "user", content: message.content });
      continue;
    }

    if (message.role === "tool") {
      payload.push(
        ...message.content.map((toolResult) => ({
          role: "tool",
          tool_call_id: toolResult.tool_use_id,
          content: toolResult.content,
        }))
      );
      continue;
    }

    payload.push({
      role: "assistant",
      content: message.content.text || "",
      ...(message.content.toolUses.length > 0
        ? {
            tool_calls: message.content.toolUses.map((toolUse) => ({
              id: toolUse.id,
              type: "function",
              function: {
                name: toolUse.name,
                arguments: JSON.stringify(toolUse.input),
              },
            })),
          }
        : {}),
    });
  }

  return payload;
}

function toOpenAITools(): Array<Record<string, unknown>> {
  return AGENT_TOOLS.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

function extractAnthropicText(blocks: AnthropicContentBlock[]): string {
  return blocks
    .flatMap((block) => {
      if (block.type === "text" && typeof block.text === "string") {
        return [block.text];
      }
      if (
        block.type === "thinking" &&
        typeof (block as AnthropicThinkingBlock).thinking === "string"
      ) {
        return [(block as AnthropicThinkingBlock).thinking!];
      }
      return [];
    })
    .join("\n")
    .trim();
}

function extractOpenAIText(
  content: string | OpenAITextPart[] | undefined
): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n")
      .trim();
  }
  return "";
}

function parseToolArguments(
  value: string | undefined
): Record<string, unknown> {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function protocolLabel(protocol: ResolvedBaseModelProtocol): string {
  return protocol === "openai" ? "OpenAI" : "Anthropic";
}

/** 归一化 AI 给的入参清单为 ParamDef[]。 */
function normalizeParams(raw: unknown): ParamDef[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const obj = (item ?? {}) as Record<string, unknown>;
    const type = obj.type;
    return {
      name: typeof obj.name === "string" ? obj.name : "",
      type:
        type === "number" || type === "boolean" || type === "image"
          ? type
          : "string",
      required: Boolean(obj.required),
      desc: typeof obj.desc === "string" ? obj.desc : undefined,
    };
  });
}

function coerceCapability(raw: unknown): ContentKind {
  if (raw === "multimodal" || raw === "image") return raw;
  return "text";
}

/** 执行 run_script 工具，返回（喂回模型的文本，是否成功，最近一次结果快照）。 */
async function execRunScript(
  input: Record<string, unknown>
): Promise<{ feedback: string; ok: boolean; snapshot: LastRunSnapshot }> {
  const code = typeof input.code === "string" ? input.code : "";
  const paramValues =
    input.paramValues && typeof input.paramValues === "object"
      ? (input.paramValues as Record<string, unknown>)
      : {};
  const apiKeyEnvName =
    typeof input.apiKeyEnvName === "string" ? input.apiKeyEnvName : undefined;
  const apiKeyValue = apiKeyEnvName ? process.env[apiKeyEnvName] : undefined;

  const result = await runScript({
    lang: "python",
    code,
    paramValues,
    apiKeyEnvName,
    apiKeyValue,
  });

  const snapshot: LastRunSnapshot = {
    code,
    apiKeyRef: apiKeyEnvName,
    lastTestInput: JSON.stringify(paramValues),
  };

  if (result.ok) {
    snapshot.lastTestOutput = result.rawOutput;
    snapshot.resultText = result.text;
    snapshot.resultImages = result.images;
    snapshot.outputDir = result.outputDir;
    const feedback = [
      "脚本执行成功，结果非空。",
      `text: ${result.text || "(空)"}`,
      `images: ${result.images.length} 张`,
      `原始输出:\n${truncate(result.rawOutput, 2000)}`,
    ].join("\n");
    return { feedback, ok: true, snapshot };
  }

  const feedback = [
    "脚本执行失败。",
    `error: ${result.error}`,
    `exitCode: ${result.exitCode}`,
    `envInfo: ${result.envInfo}`,
    `stderr:\n${truncate(result.stderr, 2000)}`,
  ].join("\n");
  return { feedback, ok: false, snapshot };
}

interface LastRunSnapshot {
  code: string;
  apiKeyRef?: string;
  lastTestInput?: string;
  lastTestOutput?: string;
  resultText?: string;
  resultImages?: string[];
  outputDir?: string;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…(已截断)`;
}

/** 简短摘要某次 tool_use 的入参，用于 SSE 进度展示。 */
function summarizeToolInput(name: string, input: Record<string, unknown>): string {
  if (name === "run_script") {
    const params = input.paramValues ? JSON.stringify(input.paramValues) : "{}";
    return `运行脚本测试，参数 ${truncate(params, 120)}`;
  }
  if (name === "install_package") {
    const pkgs = Array.isArray(input.packages) ? input.packages.join(", ") : "";
    return `安装依赖：${pkgs}`;
  }
  if (name === "save_target") {
    return `准备保存接口：${typeof input.name === "string" ? input.name : ""}`;
  }
  if (name === "ask_user") {
    return "需要你补充信息";
  }
  return "";
}

/**
 * 暂停中的会话状态（Agent 调 ask_user 等用户回答时保存）。
 * 注：模块级内存存储，dev 热重载会丢失；本地自用可接受，多用户/生产需换外部存储。
 */
interface SessionState {
  /** v4.8：本会话使用的基础大模型配置，续跑时复用。 */
  baseModel: BaseModelConfig;
  messages: AgentMessage[];
  lastSnapshot: LastRunSnapshot | null;
  /** 已执行步数，恢复后接着累计，防止 ask 来回拉满步数。 */
  stepsUsed: number;
  /** 待用户回答的 ask_user 工具调用 id（恢复时用它配对 tool_result）。 */
  askToolUseId: string;
  /** 同一轮里 ask_user 之外、已先行执行完的工具结果（恢复时与用户答案一起喂回）。 */
  pendingToolResults: ToolResultBlock[];
  createdAt: number;
}

const sessionStore = new Map<string, SessionState>();
/** 会话过期清理阈值（30 分钟）。 */
const SESSION_TTL_MS = 30 * 60 * 1000;

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pruneExpiredSessions(): void {
  const now = Date.now();
  Array.from(sessionStore.entries()).forEach(([id, state]) => {
    if (now - state.createdAt > SESSION_TTL_MS) sessionStore.delete(id);
  });
}

/**
 * 运行 Agent 接入循环。doc 为用户粘贴的对接文档。
 * 完成时 emit done（附 pending 草稿）；缺信息时 emit ask（暂停会话）；失败 emit error。
 */
export async function runAgentConnect(
  doc: string,
  baseModel: BaseModelConfig,
  emit: EmitFn
): Promise<void> {
  pruneExpiredSessions();
  const messages: AgentMessage[] = [
    {
      role: "user",
      content: `这是需要接入的 API 对接文档，请按流程自主完成接入并最终调用 save_target：\n\n${doc}`,
    },
  ];
  await runLoop(baseModel, messages, null, 0, emit);
}

/**
 * 用户回答 ask_user 后恢复会话续跑。
 * 把用户答案作为 ask_user 的 tool_result（与同轮其他工具结果一起）喂回模型，继续循环。
 */
export async function resumeAgentConnect(
  sessionId: string,
  answer: string,
  emit: EmitFn
): Promise<void> {
  pruneExpiredSessions();
  const state = sessionStore.get(sessionId);
  if (!state) {
    emit({
      type: "error",
      error: "接入会话已失效或过期，请重新发起自动接入。",
    });
    return;
  }
  sessionStore.delete(sessionId);

  const toolResults: ToolResultBlock[] = [
    ...state.pendingToolResults,
    {
      type: "tool_result",
      tool_use_id: state.askToolUseId,
      content: `用户回复：${answer}`,
    },
  ];
  const messages = [...state.messages, { role: "tool" as const, content: toolResults }];
  await runLoop(state.baseModel, messages, state.lastSnapshot, state.stepsUsed, emit);
}

/**
 * Agent 主循环（新建与恢复共用）。
 * @param startStep 已用步数，用于在恢复时接着累计步数上限。
 */
async function runLoop(
  baseModel: BaseModelConfig,
  messages: AgentMessage[],
  initialSnapshot: LastRunSnapshot | null,
  startStep: number,
  emit: EmitFn
): Promise<void> {
  let lastSnapshot: LastRunSnapshot | null = initialSnapshot;
  let activeBaseModel = baseModel;

  for (let step = startStep; step < AGENT_CONFIG.maxSteps; step += 1) {
    let response: AgentModelResponse;
    try {
      response = await callAgentModel(activeBaseModel, messages);
      activeBaseModel = withResolvedProtocol(activeBaseModel, response.protocolUsed);
    } catch (error) {
      emit({
        type: "error",
        error: `调用接入助手模型失败：${error instanceof Error ? error.message : "未知错误"}`,
        suggestion: "请确认所选基础大模型的 baseUrl/apiKey 正确、支持 tool use 且网关可用，然后重试。",
      });
      return;
    }

    if (response.text) {
      emit({ type: "thinking", text: response.text });
    }

    const toolUses = response.toolUses;

    // 模型不再调工具 → 结束。若已 save_target 过会在下面提前 return；走到这里说明未保存。
    if (toolUses.length === 0) {
      emit({
        type: "error",
        error: "接入助手结束但未成功保存接口（可能未跑通或未调用保存）。",
        suggestion: "可重试，或在下方手动编辑脚本后接入 / 强存为未验证。",
      });
      return;
    }

    messages.push({
      role: "assistant",
      content: { text: response.text, toolUses },
    });

    const toolResults: ToolResultBlock[] = [];

    for (const toolUse of toolUses) {
      const toolName = toolUse.name;
      const knownTool =
        toolName === "run_script" ||
        toolName === "install_package" ||
        toolName === "save_target" ||
        toolName === "ask_user";
      if (knownTool) {
        emit({
          type: "tool",
          tool: toolName as AgentToolName,
          summary: summarizeToolInput(toolName, toolUse.input),
        });
      }

      if (toolName === "run_script") {
        const { feedback, ok, snapshot } = await execRunScript(toolUse.input);
        lastSnapshot = snapshot;
        emit({
          type: "tool_result",
          tool: "run_script",
          ok,
          summary: ok ? "脚本跑通，结果非空" : "脚本未跑通，已把报错喂回助手",
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: feedback,
          is_error: !ok,
        });
        continue;
      }

      if (toolName === "install_package") {
        const packages = Array.isArray(toolUse.input.packages)
          ? (toolUse.input.packages as unknown[]).filter(
              (p): p is string => typeof p === "string"
            )
          : [];
        const result = await installPackages(packages);
        emit({
          type: "tool_result",
          tool: "install_package",
          ok: result.ok,
          summary: result.ok ? "依赖安装成功" : "依赖安装失败",
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: truncate(result.output, 1500),
          is_error: !result.ok,
        });
        continue;
      }

      if (toolName === "save_target") {
        const input = toolUse.input;
        const snap = lastSnapshot;
        if (!snap || !snap.resultText && !(snap.resultImages?.length)) {
          // 还没真跑通就想保存 → 拒绝，喂回让它先跑通。
          emit({
            type: "tool_result",
            tool: "save_target",
            ok: false,
            summary: "尚未跑通，拒绝保存",
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content:
              "拒绝保存：必须先用 run_script 真跑通并返回非空结果后才能保存。请先跑通。",
            is_error: true,
          });
          continue;
        }

        const pending: PendingTarget = {
          name: typeof input.name === "string" ? input.name : "未命名接口",
          code: typeof input.code === "string" ? input.code : snap.code,
          capability: coerceCapability(input.capability),
          inputParams: normalizeParams(input.inputParams),
          apiKeyRef:
            typeof input.apiKeyEnvName === "string"
              ? input.apiKeyEnvName
              : snap.apiKeyRef,
          lastTestInput: snap.lastTestInput,
          lastTestOutput: snap.lastTestOutput,
          resultText: snap.resultText,
          resultImages: snap.resultImages,
          outputDir: snap.outputDir,
        };

        emit({
          type: "tool_result",
          tool: "save_target",
          ok: true,
          summary: `已生成待确认草稿：${pending.name}`,
        });
        emit({
          type: "done",
          pending,
          message: "接入助手已跑通并整理好接口，请在下方确认结果真实有效后接入。",
        });
        return;
      }

      if (toolName === "ask_user") {
        const question =
          typeof toolUse.input.question === "string"
            ? toolUse.input.question
            : "我需要一些信息才能继续接入，请补充。";
        // 暂停会话：保存当前对话历史（含本轮 assistant 的 tool_use）+ 已先行执行的工具结果，
        // 等用户回答后由 resumeAgentConnect 把答案作为 ask_user 的 tool_result 喂回继续。
        const sessionId = newSessionId();
        sessionStore.set(sessionId, {
          baseModel: activeBaseModel,
          messages,
          lastSnapshot,
          stepsUsed: step + 1,
          askToolUseId: toolUse.id,
          pendingToolResults: toolResults,
          createdAt: Date.now(),
        });
        emit({ type: "ask", sessionId, question });
        return;
      }

      // 未知工具。
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: `未知工具：${toolName}`,
        is_error: true,
      });
    }

    // 把工具结果作为下一轮工具反馈消息喂回。
    messages.push({ role: "tool", content: toolResults });
  }

  emit({
    type: "error",
    error: `接入助手已达步数上限（${AGENT_CONFIG.maxSteps} 步）仍未跑通保存。`,
    suggestion: "可重试，或在下方手动编辑脚本后接入 / 强存为未验证。",
  });
}
