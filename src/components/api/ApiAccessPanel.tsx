"use client";

import { useState } from "react";
import type { ModelEndpoint, ModelKind, ContentKind } from "@/types";
import { toBaseModelConfig } from "@/types";
import { hasAiConfig } from "@/lib/modelFilter";
import { ApiConfigForm } from "./ApiConfigForm";
import { ScriptAccessPanel } from "./ScriptAccessPanel";

interface ApiAccessPanelProps {
  /** 所有接入项（含 base-model 和 target） */
  endpoints: ModelEndpoint[];
  onChange: (endpoints: ModelEndpoint[]) => void;
}

/**
 * 接入管理面板（v4.8 重构）：
 * 统一入口，用户在接入时必须明确标记是“基础大模型”还是“被测接口”。
 */
export function ApiAccessPanel({ endpoints, onChange }: ApiAccessPanelProps) {
  const [editing, setEditing] = useState<ModelEndpoint | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isScriptCreating, setIsScriptCreating] = useState(false);

  function handleCreateFromScript(target: ModelEndpoint) {
    onChange([...endpoints, target]);
    setIsScriptCreating(false);
  }

  function handleSave(config: ModelEndpoint) {
    const exists = endpoints.some((item) => item.id === config.id);
    onChange(
      exists
        ? endpoints.map((item) => (item.id === config.id ? config : item))
        : [...endpoints, config]
    );
    setEditing(null);
    setIsCreating(false);
  }

  function handleDelete(id: string) {
    onChange(endpoints.filter((item) => item.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  const showForm = isCreating || editing !== null;

  if (isScriptCreating) {
    const agentModels = endpoints
      .filter((ep) => hasAiConfig(ep) && ep.supportsToolUse)
      .map((ep) => ({ id: ep.id, name: ep.name, baseModel: toBaseModelConfig(ep) }));
    return (
      <ScriptAccessPanel
        onCreate={handleCreateFromScript}
        onCancel={() => setIsScriptCreating(false)}
        agentModels={agentModels}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          接口与模型管理
        </h2>
        <span className="text-xs text-slate-400">
          在此配置驱动 AI 功能的“基础大模型”以及待测的“算法接口”
        </span>
        {!showForm && (
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setIsCreating(false);
                setIsScriptCreating(true);
              }}
              className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-800"
            >
              智能接入助手
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setIsCreating(true);
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              手动新增
            </button>
          </div>
        )}
      </div>

      {showForm ? (
        <ApiConfigForm
          initial={editing}
          onCancel={() => {
            setEditing(null);
            setIsCreating(false);
          }}
          onSave={handleSave}
        />
      ) : (
        <ApiConfigList
          endpoints={endpoints}
          onEdit={(ep) => {
            setIsCreating(false);
            setEditing(ep);
          }}
          onDelete={handleDelete}
        />
      )}
    </section>
  );
}

function ApiConfigList({
  endpoints,
  onEdit,
  onDelete,
}: {
  endpoints: ModelEndpoint[];
  onEdit: (ep: ModelEndpoint) => void;
  onDelete: (id: string) => void;
}) {
  const statusLabel: Record<ModelEndpoint["status"], string> = {
    unverified: "未测试",
    tested_ok: "已就绪",
    tested_fail: "测试失败",
    unsupported: "不支持",
  };
  
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {endpoints.map((ep) => {
          const kindLabel = ep.kind === "base-model" 
            ? { text: "基础模型", class: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" }
            : { text: "被测接口", class: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" };
          
          const capLabel = ep.capability === "image" ? "生图" : ep.capability === "multimodal" ? "多模态" : "文本";

          return (
            <li
              key={ep.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {ep.name}
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${kindLabel.class}`}>
                    {kindLabel.text}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {capLabel}
                  </span>
                  {ep.kind === "base-model" && ep.supportsToolUse && (
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-600 dark:bg-purple-500/15 dark:text-purple-400">
                      Agent
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-slate-400">
                  {ep.baseUrl || ep.requestTemplate?.url || "本地脚本"}
                </span>
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(ep)}
                  className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(ep.id)}
                  className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  删除
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {endpoints.length === 0 && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-slate-200 p-4 dark:border-slate-700">
          <p className="text-xs text-slate-400">
            暂无配置。请先接入至少一个“基础大模型”以启用 AI 功能。
          </p>
        </div>
      )}
    </div>
  );
}
