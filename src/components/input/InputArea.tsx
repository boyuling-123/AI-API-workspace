"use client";

import type { ContentMode, RunMode, TaskInput } from "@/types";
import { SingleInput } from "./SingleInput";
import { BatchInput } from "./BatchInput";

interface InputAreaProps {
  projectName: string;
  contentMode: ContentMode;
  setContentMode: (mode: ContentMode) => void;
  runMode: RunMode;
  setRunMode: (mode: RunMode) => void;
  singleInput: TaskInput;
  batchInputs: TaskInput[];
  updateSingleInput: (updater: (current: TaskInput) => TaskInput) => void;
  setBatchInputs: (inputs: TaskInput[]) => void;
  /** 选中目标所需列，传给 AI 造数据作为列约束。 */
  targetColumns: string[];
  isReady: boolean;
}

/**
 * 输入区（v4 M3）：两维正交切换。
 * ContentMode（文生成类 / 图生成类）与 RunMode（单条 / 批量）独立切换，
 * 四组合各自维护独立草稿，切换互不清空。
 */
export function InputArea({
  projectName,
  contentMode,
  setContentMode,
  runMode,
  setRunMode,
  singleInput,
  batchInputs,
  updateSingleInput,
  setBatchInputs,
  targetColumns,
  isReady,
}: InputAreaProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
        <h2 className="flex items-center gap-2 font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-100 text-[11px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
            1
          </span>
          输入数据
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            <ModeButton
              active={contentMode === "text"}
              onClick={() => setContentMode("text")}
            >
              文生成类
            </ModeButton>
            <ModeButton
              active={contentMode === "image"}
              onClick={() => setContentMode("image")}
            >
              图生成类
            </ModeButton>
          </div>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            <ModeButton
              active={runMode === "single"}
              onClick={() => setRunMode("single")}
            >
              单条
            </ModeButton>
            <ModeButton
              active={runMode === "batch"}
              onClick={() => setRunMode("batch")}
            >
              批量导入
            </ModeButton>
          </div>
        </div>
      </div>

      <div className="p-5">
        {!isReady ? (
          <p className="text-sm text-slate-400">正在加载草稿…</p>
        ) : runMode === "single" ? (
          <SingleInput input={singleInput} onChange={updateSingleInput} />
        ) : (
          <BatchInput
            projectName={projectName}
            inputs={batchInputs}
            onChange={setBatchInputs}
            contentMode={contentMode}
            targetColumns={targetColumns}
          />
        )}
      </div>
    </section>
  );
}

function ModeButton({
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
      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ${
        active
          ? "bg-white text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-100"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
