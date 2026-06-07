"use client";

import { useState } from "react";
import type { BaseModelConfig, ContentMode, GenDataRequest, TaskInput } from "@/types";
import { generateTaskData } from "@/services/genDataClient";
import { exportInputsToExcel } from "@/services/excel";

interface GenDataModelOption {
  id: string;
  name: string;
  baseModel: BaseModelConfig;
}

interface GenDataPanelProps {
  /** 项目名，用于「下载数据」命名导出文件。 */
  projectName: string;
  contentMode: ContentMode;
  /** 当前目标所需列（prompt/image_url/各参数名），作为约束传给 AI。 */
  targetColumns: string[];
  /** v4.8：可用于造数据的基础大模型候选（已按 contentMode 过滤好）。 */
  modelOptions: GenDataModelOption[];
  /** 生成成功后回调：append 追加到现有批量数据，replace 覆盖。 */
  onGenerated: (items: TaskInput[], mode: "append" | "replace") => void;
}

type Shape = GenDataRequest["shape"];

/**
 * AI 造数据面板（v4.8）：两形式（造一条 / 造批量数据），
 * 调用 /api/gen-data 生成 TaskInput[] 灌入批量输入区，并支持把刚造的数据下载为本地 Excel。
 * 模型来自用户接入的基础大模型（按内容模式过滤），不再依赖任何写死模型。
 */
export function GenDataPanel({
  projectName,
  contentMode,
  targetColumns,
  modelOptions,
  onGenerated,
}: GenDataPanelProps) {
  const [open, setOpen] = useState(false);
  const [shape, setShape] = useState<Shape>("batch");
  const [count, setCount] = useState(5);
  const [requirement, setRequirement] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<TaskInput[]>([]);
  const [selectedModelId, setSelectedModelId] = useState(modelOptions[0]?.id ?? "");

  const hasModel = modelOptions.length > 0;

  async function handleGenerate() {
    if (!requirement.trim()) {
      setError("请先描述要生成什么数据");
      return;
    }
    const selected = modelOptions.find((m) => m.id === selectedModelId) ?? modelOptions[0];
    if (!selected) {
      setError(
        contentMode === "image"
          ? "暂无可用的生图基础大模型，请先在「接口与模型管理」接入一个生图(image)类基础大模型"
          : "暂无可用的基础大模型，请先在「接口与模型管理」接入一个文本/多模态基础大模型"
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const request: GenDataRequest = {
        contentMode,
        shape,
        count: shape === "one" ? 1 : count,
        requirement: requirement.trim(),
        targetColumns,
      };
      const items = await generateTaskData(request, selected.baseModel);
      onGenerated(items, shape === "one" ? "append" : "replace");
      setLastGenerated(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "造数据失败");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (lastGenerated.length === 0) {
      return;
    }
    exportInputsToExcel(projectName, lastGenerated);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 transition hover:bg-indigo-100"
      >
        ✨ AI 造数据
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-indigo-700">AI 造数据</h3>
        <span className="text-xs text-slate-400">
          AI 按需求生成测评输入（{contentMode === "image" ? "图生成类" : "文生成类"}）
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto text-xs text-slate-500 hover:underline"
        >
          收起
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-600">驱动模型</span>
        {hasModel ? (
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          >
            {modelOptions.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-amber-600">
            暂无可用{contentMode === "image" ? "生图" : "文本/多模态"}模型，请先在「接口与模型管理」接入
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-600">生成形式</span>
        <ShapeButton active={shape === "one"} onClick={() => setShape("one")}>
          造一条
        </ShapeButton>
        <ShapeButton
          active={shape === "batch"}
          onClick={() => setShape("batch")}
        >
          造批量数据
        </ShapeButton>
        {shape !== "one" && (
          <label className="ml-2 flex items-center gap-1 text-xs text-slate-600">
            条数
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
        )}
      </div>

      {targetColumns.length > 0 && (
        <p className="mb-2 text-[11px] text-slate-500">
          将按目标所需列生成：{targetColumns.join("、")}
        </p>
      )}

      <textarea
        value={requirement}
        onChange={(e) => setRequirement(e.target.value)}
        rows={3}
        placeholder="描述你想要的测评数据，例如：生成 5 条电商女装商品文案的测评提示词，覆盖连衣裙、外套、裤装等品类，风格多样。"
        className="mb-3 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm"
      />

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !hasModel}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "生成中…" : "生成数据"}
        </button>
        {lastGenerated.length > 0 && (
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-md border border-indigo-300 bg-white px-4 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
          >
            ⬇ 下载数据（{lastGenerated.length} 条 Excel）
          </button>
        )}
        <span className="text-[11px] text-slate-400">
          {shape === "one" ? "造一条会追加到现有数据" : "造批量数据会覆盖现有数据"}
        </span>
      </div>
    </div>
  );
}

function ShapeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-indigo-600 text-white"
          : "border border-slate-300 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
