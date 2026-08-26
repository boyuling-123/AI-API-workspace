"use client";

import type { ResultItem } from "@/types";

export function StatusTag({ status }: { status: ResultItem["status"] }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: "排队", className: "bg-gray-100 text-gray-500" },
    running: { label: "运行", className: "bg-blue-100 text-blue-600" },
    success: { label: "成功", className: "bg-green-100 text-green-600" },
    error: { label: "失败", className: "bg-red-100 text-red-600" },
    interrupted: { label: "中断", className: "bg-amber-100 text-amber-600" },
  };
  const item = config[status] ?? config.pending;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${item.className}`}>
      {item.label}
    </span>
  );
}

export function TargetTypeTag({
  contentKind,
}: {
  contentKind?: "text" | "multimodal" | "image";
}) {
  const item =
    contentKind === "image"
      ? { label: "生图", className: "bg-teal-50 text-teal-600" }
      : contentKind === "multimodal"
        ? { label: "多模态", className: "bg-indigo-50 text-indigo-600" }
        : { label: "文本", className: "bg-purple-50 text-purple-600" };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] ${item.className}`}>
      {item.label}
    </span>
  );
}

export function LatencyText({ latencyMs }: { latencyMs?: number }) {
  if (typeof latencyMs !== "number") {
    return null;
  }
  return (
    <span className="text-xs text-gray-400">{(latencyMs / 1000).toFixed(1)}s</span>
  );
}

interface ResultItemBodyProps {
  item: ResultItem;
  onImageClick: (src: string) => void;
}

export function ResultItemBody({ item, onImageClick }: ResultItemBodyProps) {
  if (item.status === "pending" || item.status === "running") {
    return (
      <p className="text-sm text-gray-400">
        {item.status === "pending" ? "排队中…" : "请求中…"}
      </p>
    );
  }

  if (item.status === "error" || item.status === "interrupted") {
    return <p className="text-sm text-red-600">{item.error ?? "调用失败"}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {item.outputText && (
        <p className="whitespace-pre-wrap text-sm text-gray-800">
          {item.outputText}
        </p>
      )}
      {item.outputImages && item.outputImages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.outputImages.map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- Output may use a data URL or an arbitrary user endpoint.
            <img
              key={`${item.targetId}-img-${index}`}
              src={src}
              alt={`输出图 ${index + 1}`}
              className="h-20 w-20 cursor-zoom-in rounded border border-gray-200 object-cover transition hover:opacity-80"
              onClick={() => onImageClick(src)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
