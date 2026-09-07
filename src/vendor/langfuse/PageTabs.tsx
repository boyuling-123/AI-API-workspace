"use client";

// Adapted from langfuse/langfuse@7637df1e1aadddbbfd0a45b960ecc97451381ce5
// web/src/components/layouts/page-tabs.tsx. MIT; see third_party/langfuse/LICENSE.
// Local changes: callback-only navigation, local tokens, semantic links and 44px targets.
export type PageTab = { value: string; label: string; href: string; onClick: () => void };

export function PageTabs({ tabs, activeTab }: { tabs: PageTab[]; activeTab: string }) {
  return (
    <nav aria-label="页面二级导航" className="overflow-x-auto px-6">
      <div className="inline-flex items-center justify-start gap-5">
        {tabs.map((tab) => (
          <a key={tab.value} href={tab.href}
            aria-current={tab.value === activeTab ? "page" : undefined}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              tab.onClick();
            }}
            className={`inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-1 text-sm font-medium outline-offset-4 focus-visible:outline focus-visible:outline-2 ${tab.value === activeTab ? "border-slate-900 text-slate-950 dark:border-slate-100 dark:text-white" : "border-transparent text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"}`}>
            {tab.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
