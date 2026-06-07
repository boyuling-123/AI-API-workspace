"use client";

import { useState } from "react";
import type { ReactNode } from "react";

interface CollapsiblePanelProps {
  title: ReactNode;
  description?: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

// 按需展开容器：接入/解读等面板复用它，默认收起，点击展开（延展性 A/B）
export function CollapsiblePanel({
  title,
  description,
  defaultOpen = false,
  actions,
  children,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <ChevronIcon open={open} />
          <div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</div>
            {description && (
              <div className="text-xs text-slate-400">{description}</div>
            )}
          </div>
        </button>
        {actions}
      </div>
      {open && (
        <div className="border-t border-slate-100 p-4 dark:border-slate-700">{children}</div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-slate-400 transition-transform ${
        open ? "rotate-90" : ""
      }`}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
