"use client";

import { useState, type ReactNode } from "react";
import { PageTabs } from "@/vendor/langfuse/PageTabs";
import { getWorkspacePage, WORKSPACE_PAGES, workspaceHref, type WorkspaceTab } from "@/lib/workspaceNavigation";

const ICON_PATHS: Record<string, string> = {
  datasets: "M4 4h16v16H4z M4 9h16 M9 9v11",
  targets: "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M7 7h10v10H7z",
  scorers: "M9 3h6 M10 3v6L5 19h14L14 9V3 M8 14h8",
  tasks: "M8 4H4v16h16V4h-4 M8 3h8v4H8z M8 12h8 M8 16h5",
  reports: "M4 3v18h17 M8 17v-5 M13 17V7 M18 17v-8",
  settings: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
};

export function WorkspaceFrame({ activeTab, onNavigate, toolbar, children }: {
  activeTab: WorkspaceTab; onNavigate: (tab: WorkspaceTab) => void; toolbar: ReactNode; children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const page = getWorkspacePage(activeTab);
  const search = typeof window === "undefined" ? "" : window.location.search;
  const navigate = (tab: WorkspaceTab) => { onNavigate(tab); setMenuOpen(false); };
  return (
    <div className="workspace-frame min-h-screen bg-white dark:bg-slate-950 lg:grid lg:grid-cols-[216px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-wide"><span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">评</span> 评测工作台</span>
          <button type="button" aria-expanded={menuOpen} aria-controls="workspace-primary-nav" onClick={() => setMenuOpen(!menuOpen)} className="min-h-11 px-2 text-sm lg:hidden">{menuOpen ? "收起导航" : "展开导航"}</button>
        </div>
        <nav id="workspace-primary-nav" aria-label="工作区主导航" className={`${menuOpen ? "block" : "hidden"} px-2 pb-4 lg:block`}>
          {["开发与评测", "分析与改进", "工作空间"].map((group) => (
            <div key={group} className="mb-4">
              <p className="px-3 pb-1 pt-4 text-xs font-medium text-slate-500 dark:text-slate-400">{group}</p>
              {WORKSPACE_PAGES.filter((item) => item.group === group).map((item) => (
                <a key={item.id} href={workspaceHref(search, item.tabs[0].id)} aria-current={page.id === item.id ? "page" : undefined}
                  onClick={(event) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(item.tabs[0].id); }}
                  className={`my-1 flex min-h-11 items-center gap-3 rounded-md px-3 text-sm outline-offset-2 focus-visible:outline focus-visible:outline-2 ${page.id === item.id ? "bg-slate-200/70 font-semibold text-slate-950 dark:bg-slate-800 dark:text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
                  <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={ICON_PATHS[item.id]} /></svg>{item.title}
                </a>
              ))}
              {group === "分析与改进" && <>
                <a href="/observability" className="flex min-h-11 items-center justify-between px-3 text-sm text-slate-600 dark:text-slate-300">运行监控 <span className="text-xs">Demo</span></a>
                <a href="/history-demo" className="flex min-h-11 items-center px-3 text-sm text-slate-600 dark:text-slate-300">本地历史归档</a>
                <p className="px-3 py-2 text-xs leading-6 text-slate-500 dark:text-slate-400">Benchmark · 设计中<br />Review 自进化 · 设计中</p>
              </>}
            </div>
          ))}
          <div className="border-t border-slate-200 px-3 pt-3 dark:border-slate-700">
            <a href="/assistant-tools" className="flex min-h-11 items-center justify-between text-sm">助手工具 <span className="text-xs text-slate-500">2 个只读工具</span></a>
            <a href="/interview-demo" className="flex min-h-11 items-center text-sm text-slate-600 dark:text-slate-300">演示导览</a>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">本地工作空间 · 不自动运行模型</p>
          </div>
        </nav>
      </aside>
      <div className="min-w-0">
        <div className="border-b border-slate-200 dark:border-slate-800">{toolbar}</div>
        <header className="border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-3 pt-6">
            <div><p className="mb-2 text-xs text-slate-500 dark:text-slate-400">工作空间 / {page.title}</p><h1 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{page.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">{page.description}</p></div>
            {(page.id === "tasks" || page.id === "datasets") && activeTab !== "run" && <button type="button" onClick={() => navigate("run")} className="min-h-11 rounded-md bg-slate-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-slate-950">新建评测任务</button>}
          </div>
          <PageTabs activeTab={activeTab} tabs={page.tabs.map((tab) => ({ value: tab.id, label: tab.label, href: workspaceHref(search, tab.id), onClick: () => navigate(tab.id) }))} />
        </header>
        <div id="workspace-content" className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
