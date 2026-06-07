"use client";

import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

interface AppTabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
}

// 两页式 Tab 壳：配置/结果切换。加新页只需往 tabs 数组里加一项（延展性 A）
// 放在 sticky 头部下方，样式与 design-preview 对齐
export function AppTabs({ tabs, activeId, onChange }: AppTabsProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <nav className="flex gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
                isActive
                  ? "text-brand-700 dark:text-brand-300"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge}
              {isActive && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-600" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
