"use client";

import { useEffect, useRef, useState } from "react";
import { useProject } from "@/hooks/useProject";
import { TopToolbar } from "@/components/TopToolbar";
import { WorkspaceBody } from "@/components/WorkspaceBody";
import { PetDog } from "@/components/pet/PetDog";
import { consumeWorkspaceImport } from "@/services/importWorkspaceClient";

export function AppShell() {
  const {
    project,
    saveStatus,
    saveError,
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
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <TopToolbar
          project={project}
          saveStatus={saveStatus}
          saveError={saveError}
          onRename={(name) =>
            updateProject((current) => ({ ...current, name }))
          }
          onCreateNew={() => createNew()}
          onImport={(next) => replaceProject(next)}
        />
      </header>
      <main className="flex-1">
        {importNotice && (
          <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-center text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            {importNotice}
          </div>
        )}
        <WorkspaceBody
          key={project.id}
          project={project}
          updateProject={updateProject}
        />
      </main>

      {/* 电子宠物·像素小狗（v4.7 彩蛋）：全局悬浮，两侧留白自主漫游，纯装饰、不影响业务。 */}
      <PetDog />
    </div>
  );
}
