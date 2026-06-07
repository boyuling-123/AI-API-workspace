"use client";

import { useCallback, useState } from "react";
import { useProject } from "@/hooks/useProject";
import { TopToolbar } from "@/components/TopToolbar";
import { WorkspaceBody } from "@/components/WorkspaceBody";
import { PetDog } from "@/components/pet/PetDog";
import { SetupGuard } from "@/components/SetupGuard";
import { hasAnyBaseModel } from "@/lib/modelFilter";
import type { ModelEndpoint } from "@/types";
import type { WorkspaceTab } from "@/components/WorkspaceBody";

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

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("run");

  /** 首次配置引导完成：把验证通过的 endpoint 存入项目 endpoints。 */
  const handleSetupComplete = useCallback(
    (endpoint: ModelEndpoint) => {
      updateProject((current) => ({
        ...current,
        endpoints: [...current.endpoints, endpoint],
      }));
    },
    [updateProject]
  );

  if (!isLoaded || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400 dark:bg-slate-950">
        正在加载本地项目…
      </div>
    );
  }

  // 首次使用引导：没有任何 base-model 时，展示全屏配置页
  if (!hasAnyBaseModel(project.endpoints)) {
    return <SetupGuard onComplete={handleSetupComplete} />;
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
        <WorkspaceBody
          key={project.id}
          project={project}
          updateProject={updateProject}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </main>

      {/* 电子宠物·像素小狗（v4.7 彩蛋）：全局悬浮，两侧留白自主漫游，纯装饰、不影响业务。 */}
      <PetDog />
    </div>
  );
}
