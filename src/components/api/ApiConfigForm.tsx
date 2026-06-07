"use client";

import { useState } from "react";
import type {
  BaseModelProtocol,
  ContentKind,
  ModelEndpoint,
  ModelKind,
} from "@/types";
import { generateId } from "@/lib/id";

interface ApiConfigFormProps {
  initial?: ModelEndpoint | null;
  onCancel: () => void;
  onSave: (config: ModelEndpoint) => void;
}

export function ApiConfigForm({ initial, onCancel, onSave }: ApiConfigFormProps) {
  const [draft, setDraft] = useState<ModelEndpoint>(
    initial ?? {
      id: generateId(),
      name: "",
      kind: "target",
      capability: "text",
      supportsToolUse: false,
      status: "unverified",
      baseUrl: "",
      apiKey: "",
      modelName: "",
      protocol: "auto",
      inputParams: [],
    }
  );

  function update<K extends keyof ModelEndpoint>(key: K, value: ModelEndpoint[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!draft.name.trim()) {
      alert("名称必填");
      return;
    }
    if (draft.kind === "base-model" && !draft.baseUrl?.trim()) {
      alert("基础大模型必须填写 Base URL");
      return;
    }
    onSave(draft);
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <h3 className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
        {initial ? "编辑配置" : "新增配置"}
      </h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">接入类型 (Kind)</span>
          <select
            value={draft.kind}
            onChange={(e) => update("kind", e.target.value as ModelKind)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="base-model">基础大模型 (驱动 AI 功能)</option>
            <option value="target">被测算法接口 (测评对象)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">内容能力 (Capability)</span>
          <select
            value={draft.capability}
            onChange={(e) => update("capability", e.target.value as ContentKind)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="text">纯文本 (Text)</option>
            <option value="multimodal">多模态 (Multimodal)</option>
            <option value="image">生图 (Image)</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">名称</span>
        <input
          value={draft.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder={draft.kind === "base-model" ? "如：我的 Qwen-Max" : "如：公司内部文生图 API"}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </label>

      {draft.kind === "base-model" ? (
        <div className="space-y-4 rounded-lg border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Base URL</span>
            <input
              value={draft.baseUrl || ""}
              onChange={(e) => update("baseUrl", e.target.value)}
              placeholder="https://dashscope.aliyuncs.com/apps/anthropic"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">协议类型</span>
            <select
              value={draft.protocol || "auto"}
              onChange={(e) => update("protocol", e.target.value as BaseModelProtocol)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="auto">自动探测 (Recommended)</option>
              <option value="openai">OpenAI Compatible</option>
              <option value="anthropic">Anthropic Compatible</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Model Name</span>
            <input
              value={draft.modelName || ""}
              onChange={(e) => update("modelName", e.target.value)}
              placeholder="qwen-max"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">API Key</span>
            <input
              type="password"
              value={draft.apiKey || ""}
              onChange={(e) => update("apiKey", e.target.value)}
              placeholder="sk-xxxxxx"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
            />
            <span className="text-[10px] text-slate-400">仅存本地浏览器 (IndexedDB)，绝不上传 Git，调用时走本地后端代理</span>
          </label>
          {draft.capability !== "image" && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.supportsToolUse}
                onChange={(e) => update("supportsToolUse", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">支持 Function Calling (Agent 必需)</span>
            </label>
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <p className="text-xs text-slate-500">被测接口的高级配置（脚本/HTTP 模板）将在后续版本完善。目前仅作为标记存在。</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          取消
        </button>
        <button onClick={handleSubmit} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
          保存配置
        </button>
      </div>
    </div>
  );
}
