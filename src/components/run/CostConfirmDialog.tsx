"use client";

/**
 * 生图费用确认弹框（v4 M5）。
 *
 * 触发时机：本次运行涉及生图目标（contentKind==='image'）时，
 * 点击「试运行 / 批量运行」前先弹此框估算费用，用户确认后才真正发起调用，避免误触产生大额费用。
 * 注意：multimodal 输出文字，不算生图、不触发此弹框。
 */

interface CostConfirmDialogProps {
  open: boolean;
  /** 生图调用次数（输入条数 × 生图目标数）。 */
  imageCallCount: number;
  /** 每次调用预估生成图片数（取所选目标 num_images 的最大值，至少 1）。 */
  imagesPerCall: number;
  /** 单张预估费用（元）。 */
  unitPriceYuan: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CostConfirmDialog({
  open,
  imageCallCount,
  imagesPerCall,
  unitPriceYuan,
  onConfirm,
  onCancel,
}: CostConfirmDialogProps) {
  if (!open) {
    return null;
  }

  const totalImages = imageCallCount * imagesPerCall;
  const estimatedCost = totalImages * unitPriceYuan;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              生图费用确认
            </h3>
            <p className="text-xs text-slate-400">本次运行涉及生图算法，会产生费用</p>
          </div>
        </div>

        <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">生图调用次数</span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
              {imageCallCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">每次生成图片数</span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
              {imagesPerCall}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">单张预估单价</span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
              ¥{unitPriceYuan.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              预估总费用（{totalImages} 张）
            </span>
            <span className="font-mono text-lg font-bold text-amber-600 dark:text-amber-400">
              ¥{estimatedCost.toFixed(2)}
            </span>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          费用为按单价粗略估算，实际以算法服务方计费为准。
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-amber-600"
          >
            确认并运行
          </button>
        </div>
      </div>
    </div>
  );
}
