"use client";

import { useState } from "react";
import type { ResultRow, TaskInput } from "@/types";
import { ResultItemBody, StatusTag, LatencyText } from "@/components/result/resultShared";
import { ImageLightbox } from "@/components/result/ImageLightbox";

interface TrialResultModalProps {
  open: boolean;
  onClose: () => void;
  /** 试运行结果（仅第 1 条输入）。 */
  rows: ResultRow[];
  /** 试运行的输入（用于展示本次试运行的 prompt）。 */
  inputs: TaskInput[];
  /** 是否仍在运行中（卡片显示请求中状态）。 */
  running: boolean;
}

/**
 * 试运行结果浮层窗口（v4.3 增量1）：替代原页面内嵌展示。
 * 每个目标一张结果卡片（输出/状态/耗时，图片懒加载），纯预览——不落历史、不参与评价。
 */
export function TrialResultModal({
  open,
  onClose,
  rows,
  inputs,
  running,
}: TrialResultModalProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  // 试运行仅第 1 条输入；取第一行结果。
  const row = rows[0];
  const items = row?.items ?? [];
  const trialInput = inputs[0];

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <div
          className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-900"
          onClick={(event) => event.stopPropagation()}
        >
          {/* 头部 */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-800 dark:text-slate-100">
                试运行结果
              </h2>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
                纯预览 · 不落历史
              </span>
              {running && (
                <span className="text-xs text-blue-500">运行中…</span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800"
              aria-label="关闭"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* 本次试运行输入 */}
          {trialInput && (
            <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-2.5 text-xs text-gray-500 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-gray-400">输入：</span>
              {trialInput.prompt ? (
                <span className="text-gray-700 dark:text-slate-300">
                  {trialInput.prompt.slice(0, 120)}
                  {trialInput.prompt.length > 120 ? "…" : ""}
                </span>
              ) : (
                <span className="text-gray-400">（无 prompt）</span>
              )}
              {trialInput.images.length > 0 && (
                <span className="ml-2 text-gray-400">
                  含图片 {trialInput.images.length} 张
                </span>
              )}
            </div>
          )}

          {/* 多目标结果卡片 */}
          <div className="scroll-thin flex flex-col gap-3 overflow-y-auto p-5">
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-400">
                暂无试运行结果。
              </p>
            ) : (
              items.map((item) => (
                <div
                  key={item.targetId}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800 dark:text-slate-200">
                      {item.targetName}
                    </span>
                    <div className="flex items-center gap-2">
                      <StatusTag status={item.status} />
                      {item.status === "success" && (
                        <LatencyText latencyMs={item.latencyMs} />
                      )}
                    </div>
                  </div>
                  <ResultItemBody item={item} onImageClick={setLightboxSrc} />
                </div>
              ))
            )}
          </div>

          {/* 底部 */}
          <div className="flex justify-end border-t border-gray-100 px-5 py-3 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm transition hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              关闭
            </button>
          </div>
        </div>
      </div>

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>
  );
}
