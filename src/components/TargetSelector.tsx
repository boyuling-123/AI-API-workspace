"use client";

import type { ContentMode, TargetConfig } from "@/types";
import type { InputImageState } from "@/lib/inputImageState";

interface TargetSelectorProps {
  selectedIds: string[];
  /** 当前内容模式：文生成类 / 图生成类。决定按 contentKind 置灰哪类目标。 */
  contentMode: ContentMode;
  imageState: InputImageState;
  /** 全部目标配置（含预置 + 用户接入），统一勾选。 */
  algoConfigs?: TargetConfig[];
  onChange: (ids: string[]) => void;
}

interface TargetDisabledInfo {
  disabled: boolean;
  reason?: string;
}

/**
 * 目标选择（PRD 模块4 + 需求3/5）。分「内置大模型」与「用户接入的 API」两组统一勾选，
 * 支持算法与大模型混选对比。
 * 大模型置灰规则：
 *  1. 当前输入含图，但模型为纯文本（type==='llm'）→ 置灰。
 *  2. 含 base64 图，但模型只接受 URL（imageInput==='url'）→ 提示改用 URL 或置灰。
 * 算法置灰规则：仅 status==='tested_ok' 可选，未测/失败置灰。
 */
export function TargetSelector({
  selectedIds,
  contentMode,
  imageState,
  algoConfigs = [],
  onChange,
}: TargetSelectorProps) {
  function toggle(id: string, disabled: boolean) {
    if (disabled) {
      return;
    }
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function evaluateAlgoDisabled(config: TargetConfig): TargetDisabledInfo {
    if (!config.preset && config.status !== "tested_ok") {
      return {
        disabled: true,
        reason:
          config.status === "tested_fail" ? "上次测试失败，请重新测试" : "未测试通过",
      };
    }
    return { disabled: false };
  }

  /**
   * 按内容模式筛选（不显示，不是置灰）——规则表：
   * 文本模式显示 text + multimodal；生图模式只显示 image。
   * （multimodal 输出文字，绝不进生图模式。）
   */
  function matchesContentMode(config: TargetConfig): boolean {
    if (contentMode === "text") {
      return config.contentKind === "text" || config.contentKind === "multimodal";
    }
    return config.contentKind === "image";
  }

  const visibleConfigs = algoConfigs.filter(matchesContentMode);

  // 出文字的（text / multimodal）归「大模型」组，生图归「算法 API」组。
  const llmConfigs = visibleConfigs.filter(
    (c) => c.contentKind === "text" || c.contentKind === "multimodal"
  );
  const apiConfigs = visibleConfigs.filter((c) => c.contentKind === "image");

  /**
   * 输入含图时的置灰（显示但点不了 + 提示）——规则表：
   * 输入数据栏出现图片时，仅纯文本目标（text，接不了图）置灰并提示；
   * multimodal 正常可用。
   */
  function evaluateConfigDisabled(config: TargetConfig): TargetDisabledInfo {
    const baseInfo = evaluateAlgoDisabled(config);
    if (baseInfo.disabled) {
      return baseInfo;
    }
    if (imageState.hasImage && config.contentKind === "text") {
      return {
        disabled: true,
        reason: "该目标不支持图片输入，已传入图片",
      };
    }
    return { disabled: false };
  }

  function renderCard(config: TargetConfig) {
    const { disabled, reason } = evaluateConfigDisabled(config);
    const checked = selectedIds.includes(config.id);
    const isLlm = config.contentKind === "text" || config.contentKind === "multimodal";
    const tagStyle = isLlm
      ? "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
      : "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400";
    const tagLabel = isLlm ? "大模型" : "算法 API";
    const subtitle = isLlm
      ? config.contentKind === "multimodal"
        ? "多模态 · 看图+chat"
        : "文本 · chat"
      : config.requestTemplate
        ? `${config.requestTemplate.method} ${config.requestTemplate.url}`
        : "生图算法";

    return (
      <button
        key={config.id}
        type="button"
        onClick={() => toggle(config.id, disabled)}
        disabled={disabled}
        className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all duration-150 ${
          disabled
            ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-50 dark:border-slate-800 dark:bg-slate-900"
            : checked
              ? "cursor-pointer border-brand-500 bg-brand-50 shadow-card dark:border-brand-500 dark:bg-brand-500/10"
              : "cursor-pointer border-slate-200 bg-white hover:border-slate-300 hover:shadow-card dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          readOnly
          className="h-4 w-4 accent-brand-600"
        />
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            {config.name}
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tagStyle}`}>
              {tagLabel}
            </span>
          </span>
          <span className="mt-0.5 truncate text-xs text-slate-400">
            {subtitle}
          </span>
          {disabled && reason && (
            <span className="mt-1 text-xs text-amber-600 dark:text-amber-400">{reason}</span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
        这里选择“被测试对象”：可以是大模型、你接入的算法 API，或生图/多模态接口。
        平台会把同一批输入发给已勾选目标，后续在跑批历史里做结果对比和 AI 评价。
      </div>

      {llmConfigs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            可测试大模型
          </h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {llmConfigs.map(renderCard)}
          </div>
        </div>
      )}

      {apiConfigs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            可测试算法 / 生图 API
          </h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {apiConfigs.map(renderCard)}
          </div>
        </div>
      )}

      {algoConfigs.length === 0 && (
        <p className="text-xs text-slate-400">
          暂无接入配置，可在「接入管理」中添加模型或算法 API。
        </p>
      )}

      {selectedIds.length > 0 && (
        <p className="text-center text-xs text-slate-400">
          ↕ 模型较多时可在此区域内滚动查看与选择
        </p>
      )}
    </div>
  );
}
