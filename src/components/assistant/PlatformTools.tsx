"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, ConfigProvider, Tag } from "antd";
import zhCN from "antd/locale/zh_CN";
import { ACTION_LIMITS, PLATFORM_ACTIONS, type PlatformActionName, type PlatformActionResult } from "@/lib/platformActions";
import { runPlatformAction } from "@/services/platformActionClient";

export function PlatformTools() {
  const [running, setRunning] = useState<PlatformActionName | null>(null);
  const [result, setResult] = useState<PlatformActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function run(action: PlatformActionName) {
    if (controller.current) return;
    const current = new AbortController();
    controller.current = current;
    setRunning(action);
    setError(null);
    setResult(null);
    try {
      const data = await runPlatformAction(action, current.signal);
      if (!current.signal.aborted) setResult(data);
    } catch (reason) {
      if (!current.signal.aborted) setError(reason instanceof Error ? reason.message : "工具服务暂不可用，请重试。");
    } finally {
      if (!current.signal.aborted) { controller.current = null; setRunning(null); }
    }
  }

  return <ConfigProvider locale={zhCN} theme={{ token: {
    colorPrimary: "#1554ad", colorText: "#172033", colorTextSecondary: "#475569",
    colorLink: "#1554ad", borderRadius: 6, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', controlHeight: 44,
  } }}>
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
        <nav aria-label="平台导航" className="mx-auto flex max-w-7xl flex-wrap items-center gap-5 text-sm">
          <Link href="/" className="py-2 font-semibold hover:underline">评测工作台</Link>
          <Link href="/history-demo" className="py-2 text-slate-600 hover:underline">历史归档</Link>
          <Link href="/observability" className="py-2 text-slate-600 hover:underline">Agent 观测</Link>
          <span aria-current="page" className="font-semibold text-blue-800">助手工具</span>
          <span className="ml-auto text-xs text-slate-600">只读 / 无模型调用</span>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-8">
        <section aria-labelledby="tools-title">
          <p className="mb-2 text-xs font-semibold tracking-wider text-slate-600">ASSISTANT / 工具连接</p>
          <h1 id="tools-title" className="text-2xl font-semibold sm:text-3xl">平台助手工具</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">让助手先了解平台，再按边界读取信息。这里是可执行的工具台，不是对话机器人；网页 API 与本机 MCP 复用同一业务逻辑。</p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <section aria-labelledby="available-tools" className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="available-tools" className="text-base font-semibold">可调用工具</h2>
                <Tag>2 项 · 只读</Tag>
              </div>
              <div className="mt-2 divide-y divide-slate-200">
                {PLATFORM_ACTIONS.map((action) => <div key={action.name} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-medium">{action.title}</h3>
                    <p className="mt-1 break-all font-mono text-xs text-slate-600">{action.name}</p>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">{action.description}</p>
                  </div>
                  <Button className="shrink-0" aria-label={action.title} aria-busy={running === action.name} disabled={running !== null} loading={running === action.name} onClick={() => void run(action.name)}>{action.title}</Button>
                </div>)}
              </div>
              <p className="text-xs leading-6 text-slate-600">进入页面不会读取归档。首次点击统计会顺序核对所有索引分片，不下载全部正文。</p>
            </section>

            <section aria-labelledby="action-result" className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 id="action-result" className="text-base font-semibold">本次调用结果</h2>
              <p role="status" className="mt-3 text-sm leading-6 text-slate-600">
                {running ? "正在执行只读查询，请稍候…" : error ? "调用未完成，可以重新点击工具重试。" : result ? "调用完成，未启动任何模型调用。" : "尚未调用。选择上方工具查看真实返回。"}
              </p>
              {error && <p role="alert" aria-label="工具调用错误" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
              {result?.action === "get_platform_capabilities" && <div className="mt-4 space-y-3 text-sm">
                <p className="font-medium">已开放 {result.tools.length} 项工具 · MCP 传输：{result.transport}</p>
                <ul className="list-disc space-y-2 pl-5 leading-6 text-slate-600">{result.limits.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>}
              {result?.action === "get_archive_summary" && <div className="mt-4 space-y-4 text-sm">
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 leading-6 text-amber-950">{result.summary.provenance === "synthetic" ? "合成测试夹具，不是真实评测。" : "未认证历史来源，不代表本次新跑批或模型质量验证。"}</p>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[["索引记录", result.summary.totalRecords], ["原始 ID 去重", result.summary.uniqueRecordIds], ["已核对分片", result.summary.shardCount]].map(([label, value]) => <div key={label} className="rounded-md bg-slate-50 p-3"><dt className="text-slate-600">{label}</dt><dd className="mt-1 font-mono text-xl font-semibold">{Number(value).toLocaleString("zh-CN")}</dd></div>)}
                </dl>
                <p className="leading-6 text-slate-600">{result.definitions.totalRecords}</p>
                <p className="text-xs leading-6 text-slate-600">来源核对时间：{new Date(result.summary.verifiedAt).toLocaleString("zh-CN")}，缓存快照不是实时监控。源文件变化后需重新连接。</p>
              </div>}
              {result && <details className="mt-4 text-sm"><summary className="cursor-pointer py-3 font-medium text-blue-800">查看结构化返回（不含正文）</summary><pre tabIndex={0} role="region" aria-label="结构化工具返回" className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-50 p-4 text-xs leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800">{JSON.stringify(result, null, 2)}</pre></details>}
            </section>
          </div>

          <aside className="space-y-5" aria-label="工具边界与接入">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold">接入外部 Assistant</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">本机 stdio MCP，由宿主启动独立进程，不需要新网络端口，也不要求此页面保持打开。</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">先构建，再在支持 MCP 的客户端配置 Node 入口。接入步骤和路径占位示例见仓库文档：</p>
              <code className="mt-3 block break-all rounded bg-slate-50 p-3 text-xs leading-6">docs/product/platform-actions-mcp.md</code>
              <p className="mt-3 text-xs leading-6 text-amber-950">外部宿主可能将统计发给云端模型。只向可信宿主授权；本机处理不等于宿主全链路离线。</p>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold">暂未开放</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600"><li>自动生成或运行评测任务</li><li>修改、删除项目与原始数据</li><li>读取浏览器中的项目与密钥</li><li>任意文件读取与脚本执行</li></ul>
              <p className="mt-3 text-xs leading-6 text-slate-600">后续写操作需要预览、字段确认和费用确认，不能直接把现有内部接口变成无边界工具。</p>
            </section>
          </aside>
        </div>
        <p className="text-xs leading-6 text-slate-600">{ACTION_LIMITS[0]} 无新增后端存储；不等于完整自主 Agent 已交付。</p>
      </main>
    </div>
  </ConfigProvider>;
}
