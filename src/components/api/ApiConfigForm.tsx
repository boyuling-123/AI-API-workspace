"use client";

import { useState } from "react";
import type { TargetConfig, ParamDef, ContentKind, TargetType } from "@/types";
import { generateId } from "@/lib/id";
import { CAPABILITIES } from "@/config/capabilities";

interface ApiConfigFormProps {
  initial: TargetConfig | null;
  onSave: (config: TargetConfig) => void;
  onCancel: () => void;
}

/** 表单内部扁平草稿，提交时组装为 TargetConfig（requestTemplate / comfyui 嵌套）。 */
interface DraftConfig {
  id: string;
  name: string;
  type: TargetType;
  contentKind: ContentKind;
  source: TargetConfig["source"];
  url: string;
  method: "GET" | "POST";
  headers: { key: string; value: string }[];
  bodyTemplate: string;
  inputParams: ParamDef[];
  status: TargetConfig["status"];
  apiKeyRef: string;
  outputTextPath: string;
  outputImagePath: string;
  /** 方案 B 安全能力清单：透传保留，AI 解析填入后不在编辑/保存时丢失。 */
  preprocess?: string[];
  /** ComfyUI 收窄形态字段（type==='comfyui' 时使用）。 */
  comfyServerUrl: string;
  comfyBaseModel: string;
  comfyLoraName: string;
  comfyLoraWeight: number;
  preset?: boolean;
  rawDoc?: string;
}

function targetToDraft(target: TargetConfig): DraftConfig {
  const template = target.requestTemplate;
  const comfy = target.comfyui;
  return {
    id: target.id,
    name: target.name,
    type: target.type,
    contentKind: target.contentKind,
    source: target.source,
    url: template?.url ?? "",
    method: template?.method ?? "POST",
    headers: template?.headers ?? [],
    bodyTemplate: template?.bodyTemplate ?? "",
    inputParams: target.inputParams ?? [],
    status: target.status,
    apiKeyRef: target.apiKeyRef ?? "",
    outputTextPath: template?.outputTextPath ?? "",
    outputImagePath: template?.outputImagePath ?? "",
    preprocess: template?.preprocess,
    comfyServerUrl: comfy?.serverUrl ?? "",
    comfyBaseModel: comfy?.baseModel ?? "",
    comfyLoraName: comfy?.loraName ?? "",
    comfyLoraWeight: comfy?.loraWeight ?? 1.0,
    preset: target.preset,
    rawDoc: target.rawDoc,
  };
}

function draftToTarget(draft: DraftConfig): TargetConfig {
  if (draft.type === "comfyui") {
    return {
      id: draft.id,
      name: draft.name,
      type: "comfyui",
      // ComfyUI 收窄形态恒为生图。
      contentKind: "image",
      source: draft.source,
      inputParams: draft.inputParams,
      comfyui: {
        serverUrl: draft.comfyServerUrl,
        baseModel: draft.comfyBaseModel,
        loraName: draft.comfyLoraName || undefined,
        loraWeight: draft.comfyLoraName ? draft.comfyLoraWeight : undefined,
      },
      status: draft.status,
      preset: draft.preset,
    };
  }

  return {
    id: draft.id,
    name: draft.name,
    type: "custom",
    contentKind: draft.contentKind,
    source: draft.source,
    inputParams: draft.inputParams,
    requestTemplate: {
      url: draft.url,
      method: draft.method,
      headers: draft.headers,
      bodyTemplate: draft.bodyTemplate,
      stream: false,
      preprocess:
        draft.preprocess && draft.preprocess.length > 0
          ? draft.preprocess
          : undefined,
      outputTextPath: draft.outputTextPath || undefined,
      outputImagePath: draft.outputImagePath || undefined,
    },
    apiKeyRef: draft.apiKeyRef || undefined,
    status: draft.status,
    rawDoc: draft.rawDoc,
    preset: draft.preset,
  };
}

function createEmptyDraft(): DraftConfig {
  return {
    id: generateId(),
    name: "",
    type: "custom",
    contentKind: "image",
    source: "manual",
    url: "",
    method: "POST",
    headers: [],
    bodyTemplate: "",
    inputParams: [],
    status: "unverified",
    apiKeyRef: "",
    outputTextPath: "",
    outputImagePath: "",
    comfyServerUrl: "",
    comfyBaseModel: "",
    comfyLoraName: "",
    comfyLoraWeight: 1.0,
  };
}

/**
 * 算法 API 接入表单：填写 url/method/headers/apiKeyRef、入参 ParamDef、输出提取路径，
 * 提供「测试」按钮调用 /api/test-api 判定 tested_ok/tested_fail。
 */
export function ApiConfigForm({ initial, onSave, onCancel }: ApiConfigFormProps) {
  const [draft, setDraft] = useState<DraftConfig>(
    initial ? targetToDraft(initial) : createEmptyDraft()
  );
  const [testState, setTestState] = useState<{
    running: boolean;
    message?: string;
    ok?: boolean;
  }>({ running: false });
  const [comfyList, setComfyList] = useState<{
    loading: boolean;
    checkpoints: string[];
    loras: string[];
    error?: string;
  }>({ loading: false, checkpoints: [], loras: [] });

  function update<K extends keyof DraftConfig>(key: K, value: DraftConfig[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function fetchComfyList() {
    if (!draft.comfyServerUrl.trim()) {
      setComfyList((prev) => ({ ...prev, error: "请先填写 ComfyUI 服务地址" }));
      return;
    }
    setComfyList((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const response = await fetch("/api/comfyui/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl: draft.comfyServerUrl }),
      });
      const data = await response.json();
      if (data.ok) {
        setComfyList({
          loading: false,
          checkpoints: data.checkpoints ?? [],
          loras: data.loras ?? [],
        });
      } else {
        setComfyList((prev) => ({
          ...prev,
          loading: false,
          error: data.error ?? "拉取失败",
        }));
      }
    } catch (error) {
      setComfyList((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "拉取失败",
      }));
    }
  }

  function updateHeader(index: number, field: "key" | "value", value: string) {
    setDraft((prev) => ({
      ...prev,
      headers: prev.headers.map((header, i) =>
        i === index ? { ...header, [field]: value } : header
      ),
    }));
  }

  function addHeader() {
    setDraft((prev) => ({
      ...prev,
      headers: [...prev.headers, { key: "", value: "" }],
    }));
  }

  function removeHeader(index: number) {
    setDraft((prev) => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index),
    }));
  }

  function updateParam(index: number, patch: Partial<ParamDef>) {
    setDraft((prev) => ({
      ...prev,
      inputParams: prev.inputParams.map((param, i) =>
        i === index ? { ...param, ...patch } : param
      ),
    }));
  }

  function addParam() {
    setDraft((prev) => ({
      ...prev,
      inputParams: [
        ...prev.inputParams,
        { name: "", type: "string", required: false },
      ],
    }));
  }

  function removeParam(index: number) {
    setDraft((prev) => ({
      ...prev,
      inputParams: prev.inputParams.filter((_, i) => i !== index),
    }));
  }

  function toggleCapability(capabilityId: string) {
    setDraft((prev) => {
      const current = prev.preprocess ?? [];
      const next = current.includes(capabilityId)
        ? current.filter((id) => id !== capabilityId)
        : [...current, capabilityId];
      return { ...prev, preprocess: next };
    });
  }

  async function handleTest() {
    setTestState({ running: true });
    try {
      const paramValues: Record<string, unknown> = {};
      for (const param of draft.inputParams) {
        if (param.defaultValue !== undefined) {
          paramValues[param.name] = param.defaultValue;
        } else if (param.type === "string") {
          paramValues[param.name] = "test";
        } else if (param.type === "number") {
          paramValues[param.name] = 1;
        }
      }

      const response = await fetch("/api/test-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: draftToTarget(draft), paramValues }),
      });
      const data = await response.json();

      if (data.ok) {
        setDraft((prev) => ({ ...prev, status: "tested_ok" }));
        setTestState({
          running: false,
          ok: true,
          message: `通过：耗时 ${data.latencyMs}ms，提取到文本=${data.extractedTextOk}，图片 ${data.extractedImageCount} 张`,
        });
      } else {
        setDraft((prev) => ({ ...prev, status: "tested_fail" }));
        setTestState({
          running: false,
          ok: false,
          message: `失败：${data.error ?? "未知错误"}`,
        });
      }
    } catch (error) {
      setDraft((prev) => ({ ...prev, status: "tested_fail" }));
      setTestState({
        running: false,
        ok: false,
        message: `失败：${error instanceof Error ? error.message : "未知错误"}`,
      });
    }
  }

  function handleSubmit() {
    if (!draft.name.trim()) {
      setTestState({ running: false, ok: false, message: "名称必填" });
      return;
    }
    if (draft.type === "comfyui") {
      if (!draft.comfyServerUrl.trim()) {
        setTestState({ running: false, ok: false, message: "ComfyUI 服务地址必填" });
        return;
      }
      if (!draft.comfyBaseModel.trim()) {
        setTestState({ running: false, ok: false, message: "请选择 checkpoint 基础模型" });
        return;
      }
    } else if (!draft.url.trim()) {
      setTestState({ running: false, ok: false, message: "请求 URL 必填" });
      return;
    }
    onSave(draftToTarget(draft));
  }

  const isComfy = draft.type === "comfyui";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">接入类型</span>
        <select
          value={draft.type}
          onChange={(e) => update("type", e.target.value as TargetType)}
          className="rounded border border-slate-300 px-2 py-1 text-xs"
        >
          <option value="custom">自定义 API（大模型/算法/生图）</option>
          <option value="comfyui">ComfyUI（LoRA + checkpoint）</option>
        </select>
        <span className="ml-2 text-xs font-medium text-slate-600 dark:text-slate-300">内容能力</span>
        <select
          value={isComfy ? "image" : draft.contentKind}
          disabled={isComfy}
          onChange={(e) => update("contentKind", e.target.value as ContentKind)}
          className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
        >
          <option value="text">文本</option>
          <option value="multimodal">多模态（看图+出文字）</option>
          <option value="image">生图（出图）</option>
        </select>
        <span className="text-xs text-slate-400">
          {isComfy ? "ComfyUI 收窄形态恒为生图" : "接入自定义目标，需填写 URL 与参数"}
        </span>
      </div>

      {draft.source === "agent" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          AI 已推断「内容能力」为
          <span className="mx-1 font-medium">
            {draft.contentKind === "image"
              ? "生图"
              : draft.contentKind === "multimodal"
                ? "多模态"
                : "文本"}
          </span>
          ，请核对是否正确——它决定该目标在文本/生图模式下是否可被选中，如有误请在上方下拉手动修正后再保存。
        </div>
      )}

      <Field label="名称">
        <input
          value={draft.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder={isComfy ? "如：ComfyUI SDXL 出图" : "如：文生图算法 A"}
          className="input"
        />
      </Field>

      {isComfy ? (
        <ComfyuiEditor
          draft={draft}
          onUpdate={update}
          list={comfyList}
          onFetchList={fetchComfyList}
        />
      ) : (
        <>
          <Field label="请求方法">
            <select
              value={draft.method}
              onChange={(e) =>
                update("method", e.target.value as "GET" | "POST")
              }
              className="input"
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>
          </Field>

          <Field label="请求 URL">
            <input
              value={draft.url}
              onChange={(e) => update("url", e.target.value)}
              placeholder="https://example.com/api/generate"
              className="input"
            />
          </Field>

          <Field label="请求体模板 bodyTemplate" hint="含 {{参数}} 占位，运行时用真实值填充">
            <textarea
              value={draft.bodyTemplate}
              onChange={(e) => update("bodyTemplate", e.target.value)}
              placeholder='{"prompt": "{{prompt}}"}'
              rows={3}
              className="input font-mono"
            />
          </Field>

          <Field
            label="API Key 引用名（apiKeyRef）"
            hint="只填环境变量名（如 MY_API_KEY），真值写在服务端 .env.local；留空表示无需鉴权"
          >
            <input
              value={draft.apiKeyRef ?? ""}
              onChange={(e) => update("apiKeyRef", e.target.value)}
              placeholder="MY_API_KEY"
              className="input"
            />
          </Field>

          <HeadersEditor
            headers={draft.headers}
            onAdd={addHeader}
            onUpdate={updateHeader}
            onRemove={removeHeader}
          />

          <ParamsEditor
            params={draft.inputParams}
            onAdd={addParam}
            onUpdate={updateParam}
            onRemove={removeParam}
          />

          <CapabilitiesEditor
            selected={draft.preprocess ?? []}
            onToggle={toggleCapability}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="文本输出路径（outputTextPath）" hint="如 data.caption">
              <input
                value={draft.outputTextPath ?? ""}
                onChange={(e) => update("outputTextPath", e.target.value)}
                placeholder="data.caption"
                className="input"
              />
            </Field>
            <Field label="图片输出路径（outputImagePath）" hint="如 data.images">
              <input
                value={draft.outputImagePath ?? ""}
                onChange={(e) => update("outputImagePath", e.target.value)}
                placeholder="data.images"
                className="input"
              />
            </Field>
          </div>
        </>
      )}

      {testState.message && (
        <p
          className={`text-xs ${
            testState.ok ? "text-green-600" : "text-red-600"
          }`}
        >
          {testState.message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={testState.running}
          className="rounded-md border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {testState.running ? "测试中…" : "测试连通性"}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800"
        >
          保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50"
        >
          取消
        </button>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

function HeadersEditor({
  headers,
  onAdd,
  onUpdate,
  onRemove,
}: {
  headers: { key: string; value: string }[];
  onAdd: () => void;
  onUpdate: (index: number, field: "key" | "value", value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600">请求头 Headers</span>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs text-blue-600 hover:underline"
        >
          + 添加
        </button>
      </div>
      {headers.map((header, index) => (
        <div key={index} className="flex gap-2">
          <input
            value={header.key}
            onChange={(e) => onUpdate(index, "key", e.target.value)}
            placeholder="Header 名"
            className="input flex-1"
          />
          <input
            value={header.value}
            onChange={(e) => onUpdate(index, "value", e.target.value)}
            placeholder="Header 值"
            className="input flex-1"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded-md border border-red-200 px-2 text-xs text-red-600 hover:bg-red-50"
          >
            删
          </button>
        </div>
      ))}
    </div>
  );
}

function ParamsEditor({
  params,
  onAdd,
  onUpdate,
  onRemove,
}: {
  params: ParamDef[];
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<ParamDef>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600">
          入参定义 ParamDef
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs text-blue-600 hover:underline"
        >
          + 添加
        </button>
      </div>
      {params.map((param, index) => (
        <div
          key={index}
          className="flex flex-wrap items-center gap-2 rounded-md border border-gray-100 bg-gray-50 p-2"
        >
          <input
            value={param.name}
            onChange={(e) => onUpdate(index, { name: e.target.value })}
            placeholder="参数名"
            className="input flex-1"
          />
          <select
            value={param.type}
            onChange={(e) =>
              onUpdate(index, { type: e.target.value as ParamDef["type"] })
            }
            className="input w-28"
          >
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="image">image</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={param.required}
              onChange={(e) => onUpdate(index, { required: e.target.checked })}
            />
            必填
          </label>
          <input
            value={param.desc ?? ""}
            onChange={(e) => onUpdate(index, { desc: e.target.value })}
            placeholder="说明（可选）"
            className="input flex-1"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded-md border border-red-200 px-2 text-xs text-red-600 hover:bg-red-50"
          >
            删
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * 方案 B 安全能力勾选区：用户/AI 只能从平台预置清单中勾选，结果写入
 * requestTemplate.preprocess[]。只有勾选权、无创造权，绝不执行任意代码。
 */
function CapabilitiesEditor({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (capabilityId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600">
          预置安全能力 preprocess
        </span>
        <span className="text-[11px] text-gray-400">
          只能勾选平台预置能力，发请求前由平台自有函数处理（签名/时间戳/图片编码等）
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CAPABILITIES.map((capability) => (
          <label
            key={capability.id}
            className="flex items-start gap-2 rounded-md border border-gray-100 bg-gray-50 p-2 text-xs"
          >
            <input
              type="checkbox"
              checked={selected.includes(capability.id)}
              onChange={() => onToggle(capability.id)}
              className="mt-0.5"
            />
            <span className="flex flex-col">
              <span className="font-medium text-gray-700">{capability.name}</span>
              <span className="text-[11px] text-gray-400">{capability.desc}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * ComfyUI 接入配置区（M9 收窄形态）：服务地址 + 从 /object_info 拉模型列表，
 * checkpoint / LoRA 通过下拉选择（拉取后），LoRA 权重可调。不暴露任意工作流。
 */
function ComfyuiEditor({
  draft,
  onUpdate,
  list,
  onFetchList,
}: {
  draft: DraftConfig;
  onUpdate: <K extends keyof DraftConfig>(key: K, value: DraftConfig[K]) => void;
  list: { loading: boolean; checkpoints: string[]; loras: string[]; error?: string };
  onFetchList: () => void;
}) {
  const hasList = list.checkpoints.length > 0 || list.loras.length > 0;
  return (
    <div className="flex flex-col gap-3 rounded-md border border-indigo-100 bg-indigo-50/40 p-3">
      <Field label="ComfyUI 服务地址" hint="如 http://127.0.0.1:8188（平台从这里拉取可用模型）">
        <div className="flex gap-2">
          <input
            value={draft.comfyServerUrl}
            onChange={(e) => onUpdate("comfyServerUrl", e.target.value)}
            placeholder="http://127.0.0.1:8188"
            className="input flex-1"
          />
          <button
            type="button"
            onClick={onFetchList}
            disabled={list.loading}
            className="whitespace-nowrap rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {list.loading ? "拉取中…" : "拉取模型列表"}
          </button>
        </div>
      </Field>

      {list.error && <p className="text-xs text-red-600">{list.error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="基础模型 checkpoint" hint={hasList ? undefined : "先拉取模型列表"}>
          {list.checkpoints.length > 0 ? (
            <select
              value={draft.comfyBaseModel}
              onChange={(e) => onUpdate("comfyBaseModel", e.target.value)}
              className="input"
            >
              <option value="">请选择</option>
              {list.checkpoints.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={draft.comfyBaseModel}
              onChange={(e) => onUpdate("comfyBaseModel", e.target.value)}
              placeholder="拉取后下拉选择，或手填"
              className="input"
            />
          )}
        </Field>

        <Field label="LoRA（可选）" hint={hasList ? undefined : "先拉取模型列表"}>
          {list.loras.length > 0 ? (
            <select
              value={draft.comfyLoraName}
              onChange={(e) => onUpdate("comfyLoraName", e.target.value)}
              className="input"
            >
              <option value="">不使用 LoRA</option>
              {list.loras.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={draft.comfyLoraName}
              onChange={(e) => onUpdate("comfyLoraName", e.target.value)}
              placeholder="拉取后下拉选择，或留空"
              className="input"
            />
          )}
        </Field>
      </div>

      {draft.comfyLoraName && (
        <Field label="LoRA 权重" hint="0 ~ 1.5，默认 1.0">
          <input
            type="number"
            step="0.1"
            min="0"
            max="1.5"
            value={draft.comfyLoraWeight}
            onChange={(e) => onUpdate("comfyLoraWeight", Number(e.target.value))}
            className="input"
          />
        </Field>
      )}
    </div>
  );
}
