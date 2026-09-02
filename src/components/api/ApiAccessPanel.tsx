"use client";

import { useState } from "react";
import type { TargetConfig } from "@/types";
import { getDefaultTargets } from "@/config/builtinAlgos";
import { ApiConfigForm } from "./ApiConfigForm";
import { ScriptAccessPanel } from "./ScriptAccessPanel";

interface ApiAccessPanelProps {
  /** 所有接入目标（预置 + 用户接入），统一可增删改。 */
  configs: TargetConfig[];
  onChange: (configs: TargetConfig[]) => void;
}

/**
 * 接入管理面板：每条接入目标 = 一条独立 TargetConfig。
 * 所有配置（包括默认的大模型和算法）均可编辑/删除/新增。
 */
export function ApiAccessPanel({ configs, onChange }: ApiAccessPanelProps) {
  const [editing, setEditing] = useState<TargetConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isScriptCreating, setIsScriptCreating] = useState(false);

  function handleCreateFromScript(target: TargetConfig) {
    onChange([...configs, target]);
    setIsScriptCreating(false);
  }

  function handleSave(config: TargetConfig) {
    const exists = configs.some((item) => item.id === config.id);
    onChange(
      exists
        ? configs.map((item) => (item.id === config.id ? config : item))
        : [...configs, config]
    );
    setEditing(null);
    setIsCreating(false);
  }

  function handleDelete(id: string) {
    onChange(configs.filter((item) => item.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  // 恢复默认配置：仅补回被删掉的默认项（按 id 去重），不覆盖用户已存在的同 id 配置。
  function handleRestoreDefaults() {
    const existingIds = new Set(configs.map((item) => item.id));
    const missingDefaults = getDefaultTargets().filter(
      (item) => !existingIds.has(item.id)
    );
    if (missingDefaults.length === 0) return;
    onChange([...configs, ...missingDefaults]);
  }

  const missingDefaultCount = (() => {
    const existingIds = new Set(configs.map((item) => item.id));
    return getDefaultTargets().filter((item) => !existingIds.has(item.id))
      .length;
  })();

  const showForm = isCreating || editing !== null;

  if (isScriptCreating) {
    return (
      <ScriptAccessPanel
        onCreate={handleCreateFromScript}
        onCancel={() => setIsScriptCreating(false)}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          接入管理
        </h2>
        <span className="text-xs text-slate-600 dark:text-slate-400">
          一条配置 = 一个评测目标（均可编辑/删除）
        </span>
        {!showForm && (
          <div className="ml-auto flex gap-2">
            {missingDefaultCount > 0 && (
              <button
                type="button"
                onClick={handleRestoreDefaults}
                title="把被删掉的内置大模型 / Mock 算法补回来，不影响你已新增或改过的配置"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                恢复默认（{missingDefaultCount}）
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setIsCreating(false);
                setIsScriptCreating(true);
              }}
              className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-800"
            >
              自动接入
            </button>
          </div>
        )}
      </div>

      {showForm ? (
        <ApiConfigForm
          initial={editing}
          existingConfigs={configs}
          onCancel={() => {
            setEditing(null);
            setIsCreating(false);
          }}
          onSave={handleSave}
        />
      ) : (
        <ApiConfigList
          configs={configs}
          onEdit={(config) => {
            setIsCreating(false);
            setEditing(config);
          }}
          onDelete={handleDelete}
          onRestoreDefaults={
            missingDefaultCount > 0 ? handleRestoreDefaults : undefined
          }
        />
      )}
    </section>
  );
}

function ApiConfigList({
  configs,
  onEdit,
  onDelete,
  onRestoreDefaults,
}: {
  configs: TargetConfig[];
  onEdit: (config: TargetConfig) => void;
  onDelete: (id: string) => void;
  onRestoreDefaults?: () => void;
}) {
  const statusLabel: Record<TargetConfig["status"], string> = {
    unverified: "未测试",
    tested_ok: "测试通过",
    tested_fail: "测试失败",
    unsupported: "不支持",
  };
  const statusClass: Record<TargetConfig["status"], string> = {
    unverified: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-400",
    tested_ok: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
    tested_fail: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
    unsupported: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  };
  const kindClass: Record<string, { label: string; className: string }> = {
    text: { label: "文本", className: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" },
    multimodal: { label: "多模态", className: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400" },
    image: { label: "生图", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400" },
  };

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {configs.map((config) => {
          const kind = kindClass[config.contentKind] ?? kindClass.text;
          return (
            <li
              key={config.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {config.name}
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusClass[config.status]}`}>
                    {statusLabel[config.status]}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${kind.className}`}>
                    {kind.label}
                  </span>
                </span>
                <span className="truncate text-xs text-slate-600 dark:text-slate-400">
                  {config.requestTemplate
                    ? `${config.requestTemplate.method} ${config.requestTemplate.url}`
                    : "通过平台内置通道调用"}
                </span>
                {(config.resourceVersion ||
                  (config.resourceAliases?.length ?? 0) > 0) && (
                  <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {config.resourceVersion
                      ? `版本 ${config.resourceVersion}`
                      : "未标版本"}
                    {(config.resourceAliases?.length ?? 0) > 0
                      ? ` · 别名 ${config.resourceAliases?.join(", ")}`
                      : ""}
                  </span>
                )}
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(config)}
                  className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(config.id)}
                  className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  删除
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {configs.length === 0 && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-slate-200 p-4 dark:border-slate-700">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            暂无接入配置，点击「自动接入」粘贴对接文档，接入助手自动写脚本接入模型或算法 API。
          </p>
          {onRestoreDefaults && (
            <button
              type="button"
              onClick={onRestoreDefaults}
              className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-800"
            >
              一键恢复默认配置（大模型 + Mock 算法）
            </button>
          )}
        </div>
      )}
    </div>
  );
}
