"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, ConfigProvider, Tag } from "antd";
import zhCN from "antd/locale/zh_CN";
import { WorkbenchNav } from "@/components/WorkbenchNav";
import { INTERVIEW_CHAPTERS, INTERVIEW_EVIDENCE, renderInterviewGuide } from "@/lib/interviewGuide";

export function InterviewWalkthrough({ index, fallback }: { index: number; fallback: boolean }) {
  const chapter = INTERVIEW_CHAPTERS[index];
  const [error, setError] = useState(false);
  function download() {
    setError(false);
    try {
      const url = URL.createObjectURL(new Blob([renderInterviewGuide()], { type: "text/markdown;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "中文评测工作台-面试演示手册.md"; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError(true); }
  }

  return <ConfigProvider locale={zhCN} theme={{ token: {
    colorPrimary: "#1554ad", colorText: "#172033", colorTextSecondary: "#475569", colorLink: "#1554ad",
    borderRadius: 6, controlHeight: 44, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
  } }}>
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <WorkbenchNav active="interview" note="导览不读取数据 · 不自动运行" />
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-8">
        <section aria-labelledby="interview-title" className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="mb-2 text-xs font-semibold tracking-wider text-slate-600">产品演示 / 讲清价值与边界</p>
            <h1 id="interview-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">评测工作台演示导览</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">用约 4 分钟讲清楚：为什么做、怎么用、哪些已经验证。这里提供操作顺序，不会替你启动任务，也不会把演示当作评测结果。</p>
          </div>
          <div className="shrink-0"><Button onClick={download}>下载中文讲解手册</Button></div>
        </section>
        {fallback && <p role="status" aria-label="章节提示" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">未识别该章节，已显示“产品定位”。可以从下方选择；没有执行任何任务。</p>}
        {error && <p role="alert" aria-label="手册下载错误" className="text-sm text-red-800">手册下载失败，请重试；页面内容和原始数据未改变。</p>}

        <div className="grid gap-6 lg:grid-cols-[224px_minmax(0,1fr)]">
          <aside>
            <nav aria-label="演示章节" className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-1">
              {INTERVIEW_CHAPTERS.map((item, i) => <Link prefetch={false} scroll={false} key={item.id} href={`/interview-demo?chapter=${item.id}`}
                aria-current={i === index ? "step" : undefined}
                className={`flex min-h-16 items-center gap-3 rounded-md border px-3 py-3 text-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800 ${i === index ? "border-blue-200 bg-blue-50 text-blue-900" : "border-transparent text-slate-600 hover:bg-slate-50"}`}>
                <span className="font-mono text-sm" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <span><span className="block font-semibold">{item.title}</span><span className="mt-1 block text-xs">建议 {item.duration}</span></span>
              </Link>)}
            </nav>
            <p className="mt-3 text-xs leading-6 text-slate-600">章节高亮只表示当前位置，不代表操作已完成或验收已通过。可随时跳转。</p>
          </aside>

          <section aria-labelledby="chapter-title" className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600"><span>章节 {index + 1} / {INTERVIEW_CHAPTERS.length}</span><Tag>{chapter.label}</Tag></div>
            <h2 id="chapter-title" className="mt-4 max-w-3xl text-xl font-semibold leading-8 sm:text-2xl">{chapter.headline}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{chapter.message}</p>
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0">
                <h3 className="font-semibold">现场怎么操作</h3>
                <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-7 text-slate-700">{chapter.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                <p className="mt-5 text-xs leading-6 text-slate-600">{chapter.access}</p>
                <Link prefetch={false} href={chapter.href} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-blue-800 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800">{chapter.action}</Link>
              </div>
              <aside aria-label="讲解依据" className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold">看什么证据</h3><p className="mt-2 text-sm leading-7 text-slate-600">{chapter.evidence}</p>
              </aside>
            </div>
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-sm font-semibold text-amber-950">不要夸大什么</h3><p className="mt-2 text-sm leading-7 text-slate-600">{chapter.boundary}</p>
            </div>
            <nav aria-label="章节翻页" className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4 text-sm">
              {index > 0 ? <Link prefetch={false} scroll={false} href={`/interview-demo?chapter=${INTERVIEW_CHAPTERS[index - 1].id}`} className="inline-flex min-h-11 items-center font-medium text-blue-800 hover:underline">上一章：{INTERVIEW_CHAPTERS[index - 1].title}</Link> : <span className="inline-flex min-h-11 items-center text-slate-600">从产品问题开始</span>}
              {index < INTERVIEW_CHAPTERS.length - 1 ? <Link prefetch={false} scroll={false} href={`/interview-demo?chapter=${INTERVIEW_CHAPTERS[index + 1].id}`} className="inline-flex min-h-11 items-center font-medium text-blue-800 hover:underline">下一章：{INTERVIEW_CHAPTERS[index + 1].title}</Link> : <span className="inline-flex min-h-11 items-center text-slate-600">导览结束，不自动运行任务</span>}
            </nav>
          </section>
        </div>

        <details className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm" open={chapter.id === "engineering"}>
          <summary className="cursor-pointer py-2 font-semibold">开源来源与工程证据</summary>
          <p className="mt-2 text-xs leading-6 text-slate-600">以下为公开 GitHub 文档与 PR，点击后在新标签打开；不自动检测远端状态。</p>
          <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">{INTERVIEW_EVIDENCE.map((item) => <li key={item.href}><a href={item.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-blue-800 hover:underline">{item.title}<span className="sr-only">（新标签页）</span></a></li>)}</ul>
        </details>
      </main>
    </div>
  </ConfigProvider>;
}
