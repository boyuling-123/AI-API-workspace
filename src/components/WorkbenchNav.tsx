import Link from "next/link";

const links = [
  { id: "run", title: "数据与跑批", href: "/?tab=run" },
  { id: "history", title: "历史归档", href: "/history-demo" },
  { id: "observability", title: "Agent 观测", href: "/observability" },
  { id: "assistant", title: "助手工具", href: "/assistant-tools" },
  { id: "interview", title: "演示导览", href: "/interview-demo" },
] as const;

export function WorkbenchNav({ active, note }: { active: typeof links[number]["id"]; note: string }) {
  const returnChapter = active === "interview" || active === "run" ? "positioning" : active;
  return <header className="border-b border-slate-200 bg-white px-5 py-2 sm:px-8">
    <nav aria-label="平台导航" className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      <Link prefetch={false} href="/" className="inline-flex min-h-11 items-center font-semibold text-slate-900 hover:underline">评测工作台</Link>
      {links.map((link) => link.id === active
        ? <span key={link.id} aria-current="page" className="inline-flex min-h-11 items-center font-semibold text-blue-800">{link.title}</span>
        : <Link key={link.id} prefetch={false} href={link.id === "interview" ? `${link.href}?chapter=${returnChapter}` : link.href}
          className="inline-flex min-h-11 items-center text-slate-600 hover:text-blue-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800">{link.title}</Link>)}
      <span className="py-2 text-xs text-slate-600 xl:ml-auto">{note}</span>
    </nav>
  </header>;
}
