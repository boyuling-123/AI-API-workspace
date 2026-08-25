"use client";

import { useRef, useState } from "react";
import type {
  AgentStreamEvent,
  ContentKind,
  ParamDef,
  PendingTarget,
  TargetConfig,
} from "@/types";
import {
  startAgentConnect,
  resumeAgentConnect,
  confirmTarget,
} from "@/services/agentConnectClient";

interface ScriptAccessPanelProps {
  /** 用户「确认接入」后回调，返回组装好的正式目标。 */
  onCreate: (target: TargetConfig) => void;
  onCancel: () => void;
}

/** 接入流程阶段。asking = Agent 缺信息提问、等用户回答。 */
type Phase = "input" | "running" | "asking" | "confirm" | "failed";

/** 进度区一条记录。 */
interface ProgressItem {
  kind: "thinking" | "tool" | "tool_result";
  ok?: boolean;
  text: string;
}

/** 接入对话区一条消息（Agent 提问 / 用户回答）。 */
interface ChatTurn {
  role: "agent" | "user";
  text: string;
}

const KIND_LABEL: Record<ContentKind, string> = {
  text: "文生成类（纯文本）",
  multimodal: "多模态（看图出文字）",
  image: "图生成类（输出图片）",
};

/**
 * Agent 自动接入面板（v4.4）。
 * 粘贴对接文档 → 开始 → 实时进度区（消费 SSE）→ 跑通后三项确认页 → 用户「确认接入」存为目标。
 * 失败时展示原因 + 建议，支持重试 / 手动编辑后接入 / 强存未验证。
 */
export function ScriptAccessPanel({ onCreate, onCancel }: ScriptAccessPanelProps) {
  const [phase, setPhase] = useState<Phase>("input");
  const [doc, setDoc] = useState("");
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [pending, setPending] = useState<PendingTarget | null>(null);
  const [doneMessage, setDoneMessage] = useState("");
  const [failure, setFailure] = useState<{ error: string; suggestion?: string } | null>(
    null
  );
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [sessionId, setSessionId] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  function appendProgress(item: ProgressItem) {
    setProgress((prev) => [...prev, item]);
  }

  function handleEvent(event: AgentStreamEvent) {
    if (event.type === "thinking") {
      appendProgress({ kind: "thinking", text: event.text });
      return;
    }
    if (event.type === "tool") {
      appendProgress({ kind: "tool", text: `${toolLabel(event.tool)}：${event.summary}` });
      return;
    }
    if (event.type === "tool_result") {
      appendProgress({
        kind: "tool_result",
        ok: event.ok,
        text: `${toolLabel(event.tool)} → ${event.summary}`,
      });
      return;
    }
    if (event.type === "ask") {
      setSessionId(event.sessionId);
      setChat((prev) => [...prev, { role: "agent", text: event.question }]);
      setPhase("asking");
      return;
    }
    if (event.type === "done") {
      setPending(event.pending);
      setDoneMessage(event.message);
      setPhase("confirm");
      return;
    }
    if (event.type === "error") {
      setFailure({ error: event.error, suggestion: event.suggestion });
      setPhase("failed");
    }
  }

  async function handleStart() {
    if (!doc.trim()) return;
    setProgress([]);
    setPending(null);
    setFailure(null);
    setChat([]);
    setSessionId("");
    setPhase("running");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await startAgentConnect(doc, handleEvent, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) return;
      setFailure({
        error: error instanceof Error ? error.message : "接入过程异常",
        suggestion: "可重试，或手动编辑脚本后接入。",
      });
      setPhase("failed");
    } finally {
      abortRef.current = null;
    }
  }

  async function handleAnswer(answer: string) {
    const currentSession = sessionId;
    if (!answer.trim() || !currentSession) return;
    setChat((prev) => [...prev, { role: "user", text: answer }]);
    setSessionId("");
    setPhase("running");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await resumeAgentConnect(currentSession, answer, handleEvent, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) return;
      setFailure({
        error: error instanceof Error ? error.message : "续跑接入异常",
        suggestion: "可重试，或手动编辑脚本后接入。",
      });
      setPhase("failed");
    } finally {
      abortRef.current = null;
    }
  }

  function handleCancelRunning() {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("input");
  }

  async function handleConfirm(finalPending: PendingTarget, force: boolean) {
    try {
      if (force) {
        onCreate(buildUnverifiedTarget(finalPending, doc));
        return;
      }
      const target = await confirmTarget(finalPending, doc);
      onCreate(target);
    } catch (error) {
      setFailure({
        error: error instanceof Error ? error.message : "确认接入失败",
        suggestion: "可重试确认，或强存为未验证。",
      });
      setPhase("failed");
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <ScriptAccessHeader onCancel={onCancel} />

      {phase === "input" && (
        <InputStage doc={doc} onDocChange={setDoc} onStart={handleStart} />
      )}

      {(phase === "running" || phase === "asking") && (
        <ProgressStage
          progress={progress}
          chat={chat}
          asking={phase === "asking"}
          onAnswer={handleAnswer}
          onCancel={handleCancelRunning}
        />
      )}

      {phase === "confirm" && pending && (
        <ConfirmStage
          pending={pending}
          message={doneMessage}
          progress={progress}
          onConfirm={(p) => handleConfirm(p, false)}
          onForceSave={(p) => handleConfirm(p, true)}
          onRestart={() => setPhase("input")}
        />
      )}

      {phase === "failed" && (
        <FailedStage
          failure={failure}
          progress={progress}
          onRetry={handleStart}
          onBackToInput={() => setPhase("input")}
          onManualSave={(p) => handleConfirm(p, true)}
        />
      )}
    </section>
  );
}

function toolLabel(tool: string): string {
  if (tool === "run_script") return "运行脚本";
  if (tool === "install_package") return "安装依赖";
  if (tool === "save_target") return "保存接口";
  if (tool === "ask_user") return "向你提问";
  return tool;
}

function buildUnverifiedTarget(pending: PendingTarget, rawDoc: string): TargetConfig {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    name: pending.name?.trim() || "未命名接口",
    type: "custom",
    contentKind: coerceCapability(pending.capability),
    source: "agent",
    inputParams: normalizeParams(pending.inputParams),
    apiKeyRef: pending.apiKeyRef || undefined,
    status: "unverified",
    rawDoc,
    script: {
      lang: "python",
      code: pending.code,
      verified: false,
      lastTestInput: pending.lastTestInput,
      lastTestOutput: pending.lastTestOutput,
      outputDir: pending.outputDir,
    },
  };
}

function coerceCapability(raw: unknown): ContentKind {
  if (raw === "multimodal" || raw === "image") return raw;
  return "text";
}

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

function ScriptAccessHeader({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        自动接入（Agent）
      </h2>
      <span className="text-xs text-slate-400">
        粘贴对接文档，接入助手自动写脚本、跑通、整理参数
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        返回
      </button>
    </div>
  );
}

function InputStage({
  doc,
  onDocChange,
  onStart,
}: {
  doc: string;
  onDocChange: (value: string) => void;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
        对接文档（粘贴接口说明、鉴权方式、请求/响应示例等）
      </label>
      <textarea
        value={doc}
        onChange={(event) => onDocChange(event.target.value)}
        rows={12}
        placeholder="把目标 API 的对接文档整段粘贴到这里。接入助手会据此写 Python 脚本、本机实跑、自动装缺失依赖、修复直到跑通。"
        className="w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!doc.trim()}
          onClick={onStart}
          className="rounded-lg bg-brand-700 px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          开始自动接入
        </button>
        <span className="text-xs text-slate-400">
          接入助手固定使用 DeepSeek，需在 .env.local 配置 DASHSCOPE_API_KEY
        </span>
      </div>
    </div>
  );
}

function ProgressStage({
  progress,
  chat,
  asking,
  onAnswer,
  onCancel,
}: {
  progress: ProgressItem[];
  chat: ChatTurn[];
  asking: boolean;
  onAnswer: (answer: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {asking ? (
          <>
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              接入助手需要你补充信息
            </span>
          </>
        ) : (
          <>
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              接入助手工作中…
            </span>
          </>
        )}
        {!asking && (
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            取消
          </button>
        )}
      </div>
      <ProgressList progress={progress} />
      {chat.length > 0 && <ChatArea chat={chat} asking={asking} onAnswer={onAnswer} />}
    </div>
  );
}

function ChatArea({
  chat,
  asking,
  onAnswer,
}: {
  chat: ChatTurn[];
  asking: boolean;
  onAnswer: (answer: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function submit() {
    if (!draft.trim()) return;
    onAnswer(draft.trim());
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-500/30 dark:bg-amber-500/5">
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
        补充信息对话
      </span>
      <ul className="flex flex-col gap-2">
        {chat.map((turn, index) => (
          <li
            key={index}
            className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-1.5 text-xs ${
                turn.role === "user"
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {turn.role === "agent" ? `🤖 ${turn.text}` : turn.text}
            </span>
          </li>
        ))}
      </ul>
      {asking && (
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="在这里回答接入助手的问题（如填入 Key、参数取值，或补一段文档）。Ctrl/⌘+Enter 发送"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
          <button
            type="button"
            disabled={!draft.trim()}
            onClick={submit}
            className="rounded-lg bg-brand-700 px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            发送
          </button>
        </div>
      )}
    </div>
  );
}

function ProgressList({ progress }: { progress: ProgressItem[] }) {
  if (progress.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-400 dark:border-slate-700">
        正在连接接入助手…
      </div>
    );
  }
  return (
    <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
      {progress.map((item, index) => (
        <li key={index} className="flex items-start gap-2 text-xs">
          <ProgressIcon item={item} />
          <span
            className={
              item.kind === "thinking"
                ? "text-slate-500 dark:text-slate-400"
                : "text-slate-700 dark:text-slate-200"
            }
          >
            {item.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ProgressIcon({ item }: { item: ProgressItem }) {
  if (item.kind === "thinking") {
    return <span className="mt-0.5 text-slate-400">💭</span>;
  }
  if (item.kind === "tool") {
    return <span className="mt-0.5 text-brand-500">⚙️</span>;
  }
  return (
    <span className={`mt-0.5 ${item.ok ? "text-green-500" : "text-amber-500"}`}>
      {item.ok ? "✓" : "⚠️"}
    </span>
  );
}

function ConfirmStage({
  pending,
  message,
  progress,
  onConfirm,
  onForceSave,
  onRestart,
}: {
  pending: PendingTarget;
  message: string;
  progress: ProgressItem[];
  onConfirm: (pending: PendingTarget) => void;
  onForceSave: (pending: PendingTarget) => void;
  onRestart: () => void;
}) {
  const [name, setName] = useState(pending.name);
  const [code, setCode] = useState(pending.code);
  const [capability, setCapability] = useState<ContentKind>(
    coerceCapability(pending.capability)
  );
  const [apiKeyRef, setApiKeyRef] = useState(pending.apiKeyRef ?? "");
  const [params, setParams] = useState<ParamDef[]>(
    normalizeParams(pending.inputParams)
  );
  const [showCode, setShowCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function buildFinal(): PendingTarget {
    return {
      ...pending,
      name: name.trim() || "未命名接口",
      code,
      capability,
      apiKeyRef: apiKeyRef.trim() || undefined,
      inputParams: params,
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
        ✓ 接入助手已跑通。请核对下方三项结果真实有效后再确认接入。
        {message && <p className="mt-1 text-green-600 dark:text-green-400">{message}</p>}
      </div>

      <ThreePanelResult pending={pending} />

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          接口信息（可微调）
        </span>
        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
          接口名称
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-slate-200 px-2 py-1.5 text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
          能力标签
          <select
            value={capability}
            onChange={(event) => setCapability(event.target.value as ContentKind)}
            className="rounded-md border border-slate-200 px-2 py-1.5 text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {(Object.keys(KIND_LABEL) as ContentKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
          API Key 环境变量名（可空）
          <input
            value={apiKeyRef}
            onChange={(event) => setApiKeyRef(event.target.value)}
            placeholder="如 MY_API_KEY，真值存 .env.local"
            className="rounded-md border border-slate-200 px-2 py-1.5 font-mono text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </label>

        <ParamEditor params={params} onChange={setParams} />

        <CodeEditor
          code={code}
          show={showCode}
          onToggle={() => setShowCode((prev) => !prev)}
          onChange={setCode}
        />
      </div>

      <ProgressFold progress={progress} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setSubmitting(true);
            onConfirm(buildFinal());
          }}
          className="rounded-lg bg-brand-700 px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-800 disabled:opacity-50"
        >
          确认接入
        </button>
        <button
          type="button"
          onClick={() => onForceSave(buildFinal())}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          强存为未验证
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          重新接入
        </button>
      </div>
    </div>
  );
}

function ThreePanelResult({ pending }: { pending: PendingTarget }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          ① 本次测试塞入的输入参数
        </span>
        <pre className="max-h-32 overflow-auto rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
          {pending.lastTestInput || "(无)"}
        </pre>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          ② 脚本真实返回的原始输出
        </span>
        <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
          {pending.lastTestOutput || "(无)"}
        </pre>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          ③ 渲染结果
        </span>
        {pending.resultText && (
          <p className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
            {pending.resultText}
          </p>
        )}
        {pending.resultImages && pending.resultImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pending.resultImages.map((src, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={index}
                src={src}
                alt={`结果图片 ${index + 1}`}
                loading="lazy"
                className="h-32 w-32 rounded border border-slate-200 object-cover dark:border-slate-700"
              />
            ))}
          </div>
        )}
        {!pending.resultText &&
          !(pending.resultImages && pending.resultImages.length > 0) && (
            <span className="text-xs text-slate-400">(无渲染结果)</span>
          )}
      </div>
    </div>
  );
}

function ParamEditor({
  params,
  onChange,
}: {
  params: ParamDef[];
  onChange: (params: ParamDef[]) => void;
}) {
  function update(index: number, patch: Partial<ParamDef>) {
    onChange(params.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function remove(index: number) {
    onChange(params.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...params, { name: "", type: "string", required: false }]);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-slate-500 dark:text-slate-400">入参清单</span>
      {params.length === 0 && (
        <span className="text-xs text-slate-400">（无入参）</span>
      )}
      {params.map((param, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <input
            value={param.name}
            onChange={(event) => update(index, { name: event.target.value })}
            placeholder="参数名"
            className="w-28 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
          <select
            value={param.type}
            onChange={(event) =>
              update(index, { type: event.target.value as ParamDef["type"] })
            }
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="image">image</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={param.required}
              onChange={(event) => update(index, { required: event.target.checked })}
            />
            必填
          </label>
          <input
            value={param.desc ?? ""}
            onChange={(event) => update(index, { desc: event.target.value })}
            placeholder="说明"
            className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
          <button
            type="button"
            onClick={() => remove(index)}
            className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            删
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        + 添加参数
      </button>
    </div>
  );
}

function CodeEditor({
  code,
  show,
  onToggle,
  onChange,
}: {
  code: string;
  show: boolean;
  onToggle: () => void;
  onChange: (code: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        className="self-start text-xs text-brand-600 hover:underline dark:text-brand-400"
      >
        {show ? "▼ 收起脚本代码" : "▶ 展开 / 手动编辑脚本代码"}
      </button>
      {show && (
        <textarea
          value={code}
          onChange={(event) => onChange(event.target.value)}
          rows={16}
          className="w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />
      )}
    </div>
  );
}

function ProgressFold({ progress }: { progress: ProgressItem[] }) {
  const [open, setOpen] = useState(false);
  if (progress.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="self-start text-xs text-slate-500 hover:underline dark:text-slate-400"
      >
        {open ? "▼ 收起接入过程" : `▶ 查看接入过程（${progress.length} 步）`}
      </button>
      {open && <ProgressList progress={progress} />}
    </div>
  );
}

function FailedStage({
  failure,
  progress,
  onRetry,
  onBackToInput,
  onManualSave,
}: {
  failure: { error: string; suggestion?: string } | null;
  progress: ProgressItem[];
  onRetry: () => void;
  onBackToInput: () => void;
  onManualSave: (pending: PendingTarget) => void;
}) {
  const [showManual, setShowManual] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [capability, setCapability] = useState<ContentKind>("text");

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
        ✗ 自动接入未成功
        <p className="mt-1 whitespace-pre-wrap">{failure?.error ?? "未知错误"}</p>
        {failure?.suggestion && (
          <p className="mt-2 text-red-600 dark:text-red-400">
            建议：{failure.suggestion}
          </p>
        )}
      </div>

      <ProgressFold progress={progress} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-brand-700 px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-800"
        >
          重试
        </button>
        <button
          type="button"
          onClick={() => setShowManual((prev) => !prev)}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          手动编辑后接入
        </button>
        <button
          type="button"
          onClick={onBackToInput}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          重新粘贴文档
        </button>
      </div>

      {showManual && (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            手动兜底（强存为未验证目标，后续可在编辑里再测）
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="接口名称"
            className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
          <select
            value={capability}
            onChange={(event) => setCapability(event.target.value as ContentKind)}
            className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {(Object.keys(KIND_LABEL) as ContentKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABEL[kind]}
              </option>
            ))}
          </select>
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            rows={12}
            placeholder="粘贴 / 编写 Python 脚本（从 stdin 读 params JSON，最后 print RESULT_JSON 标记结果）"
            className="w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
          <button
            type="button"
            disabled={!name.trim() || !code.trim()}
            onClick={() =>
              onManualSave({
                name: name.trim(),
                code,
                capability,
                inputParams: [],
              })
            }
            className="self-start rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            强存为未验证
          </button>
        </div>
      )}
    </div>
  );
}
