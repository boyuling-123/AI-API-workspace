"use client";

import { useRef, useState } from "react";
import type { Project } from "@/types";
import type { SaveStatus } from "@/hooks/useProject";
import { exportProjectToJson, parseImportedProject } from "@/services/projectIO";
import { useTheme } from "@/hooks/useTheme";

interface TopToolbarProps {
  project: Project;
  saveStatus: SaveStatus;
  saveError: string | null;
  onRename: (name: string) => void;
  onCreateNew: () => void;
  onImport: (next: Project) => void;
}

export function TopToolbar({
  project,
  saveStatus,
  saveError,
  onRename,
  onCreateNew,
  onImport,
}: TopToolbarProps) {
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function handleCreateNew() {
    const confirmed = window.confirm(
      "新建项目会切换当前编辑内容。如有未导出的修改，建议先导出 JSON 备份。确认新建？"
    );
    if (confirmed) {
      onCreateNew();
      setImportError(null);
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const text = await file.text();
    const result = parseImportedProject(text);
    if (!result.ok || !result.project) {
      setImportError(result.error ?? "导入失败");
      return;
    }

    const confirmed = window.confirm(
      "导入会覆盖当前项目。如有未导出的修改，建议先导出 JSON 备份。确认导入？"
    );
    if (!confirmed) {
      return;
    }
    onImport(result.project);
    setImportError(null);
  }

  return (
    <div className="flex flex-col">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        {/* 品牌区：蓝色 logo + 双行平台名 */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white shadow-card">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </div>
          <div className="hidden sm:block">
            <h1 className="font-mono text-sm font-bold leading-none text-brand-800 dark:text-brand-300">
              模型评测平台
            </h1>
            <p className="mt-0.5 text-[10px] leading-none text-slate-600 dark:text-slate-400">
              EVALUATION PLATFORM
            </p>
          </div>
        </div>

        {/* 项目名输入：文件夹图标 + 内嵌输入 */}
        <div className="ml-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
          <svg
            className="h-3.5 w-3.5 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7L9.4 4.6A2 2 0 0 0 8 4H5a2 2 0 0 0-2 2z" />
          </svg>
          <input
            value={project.name}
            onChange={(event) => onRename(event.target.value)}
            placeholder="项目名称"
            className="w-40 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
          />
        </div>

        <SaveStatusBadge status={saveStatus} />

        {/* 右侧操作区 */}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCreateNew}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="hidden sm:inline">新建</span>
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="hidden sm:inline">导入</span>
          </button>
          <button
            type="button"
            onClick={() => exportProjectToJson(project)}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="hidden sm:inline">导出</span>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="切换主题"
            title={theme === "dark" ? "切换到亮色" : "切换到暗色"}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors duration-150 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {theme === "dark" ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {(saveError || importError) && (
        <p className="mx-auto w-full max-w-6xl px-4 pb-2 text-xs text-red-600 sm:px-6">
          {saveError ?? importError}
        </p>
      )}
    </div>
  );
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "saved" || status === "idle") {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 md:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {status === "saved" ? "已自动保存" : "等待编辑"}
      </span>
    );
  }
  const config: Record<"saving" | "error", { label: string; className: string }> = {
    saving: { label: "保存中…", className: "text-brand-700" },
    error: { label: "保存失败", className: "text-red-600" },
  };
  const item = config[status];
  return (
    <span className={`hidden text-xs md:inline ${item.className}`}>
      {item.label}
    </span>
  );
}

function SunIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
    </svg>
  );
}
