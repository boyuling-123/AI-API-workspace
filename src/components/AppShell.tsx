"use client";

import { useEffect, useRef, useState } from "react";
import { useProject } from "@/hooks/useProject";
import { TopToolbar } from "@/components/TopToolbar";
import { WorkspaceBody } from "@/components/WorkspaceBody";
import { consumeWorkspaceImport } from "@/services/importWorkspaceClient";

export function AppShell() {
  const {
    project,
    saveStatus,
    saveError,
    retainedProjectCount,
    isLoaded,
    updateProject,
    replaceProject,
    createNew,
  } = useProject();
  const processedImportId = useRef<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !project) return;
    const params = new URLSearchParams(window.location.search);
    const importId = params.get("import_id");
    if (!importId || processedImportId.current === importId) return;
    processedImportId.current = importId;
    const confirmedImportId = importId;

    async function consume() {
      try {
        const result = await consumeWorkspaceImport(confirmedImportId);
        replaceProject(result.project);
        window.history.replaceState(null, "", result.openPath);
        const skipped =
          result.summary.skipped > 0 ? `，跳过 ${result.summary.skipped} 条` : "";
        const warnings =
          result.warnings.length > 0 ? `；提醒：${result.warnings.join("；")}` : "";
        setImportNotice(
          `已导入 ${result.summary.imported} 条评测数据${skipped}${warnings}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "导入失败";
        setImportNotice(`导入失败：${message}`);
      }
    }

    consume();
  }, [isLoaded, project, replaceProject]);

  if (!isLoaded || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400 dark:bg-slate-950">
        正在加载本地项目…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-200">
      <main className="flex-1">
        {retainedProjectCount > 0 && (
          <div role="status" aria-label="旧项目保留提示" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <strong>发现 {retainedProjectCount} 条暂不兼容的本地项目，未加载，但已原样保留。</strong>
            <p>这些记录仍在当前浏览器中，未迁移，也不是备份。当前项目导出不包含这些记录；请勿清理浏览器数据，后续可使用兼容版本处理。</p>
          </div>
        )}
        {importNotice && (
          <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-center text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            {importNotice}
          </div>
        )}
        <WorkspaceBody
          key={project.id}
          project={project}
          toolbar={<TopToolbar
            project={project}
            saveStatus={saveStatus}
            saveError={saveError}
            onRename={(name) => updateProject((current) => ({ ...current, name }))}
            onCreateNew={() => createNew()}
            onImport={(next) => replaceProject(next)}
          />}
          updateProject={updateProject}
        />
      </main>

    </div>
  );
}
