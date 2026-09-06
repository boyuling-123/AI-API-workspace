"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, ConfigProvider, Modal, Table, Tag } from "antd";
import zhCN from "antd/locale/zh_CN";
import { ARCHIVE_TYPES, type ArchiveContent, type ArchivePage, type ArchiveRow, type ArchiveSummary } from "@/lib/localArchive";
import { readLocalArchive } from "@/services/localArchiveClient";

const number = (value: number) => value.toLocaleString("zh-CN");

export function LocalArchiveDemo() {
  const [summary, setSummary] = useState<ArchiveSummary | null>(null);
  const [page, setPage] = useState<ArchivePage | null>(null);
  const [query, setQuery] = useState({ shard: 0, page: 1, type: "" });
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ArchiveRow | null>(null);
  const [content, setContent] = useState<ArchiveContent | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const contentRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    setLoading(true);
    setPage(null);
    void (async () => {
      try {
        const nextSummary = await readLocalArchive<ArchiveSummary>({ action: "summary" }, controller.signal);
        if (controller.signal.aborted) return;
        setSummary(nextSummary);
        const nextPage = await readLocalArchive<ArchivePage>({ action: "page", ...query }, controller.signal);
        if (!controller.signal.aborted) setPage(nextPage);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "无法读取本地归档。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [query, revision]);
  useEffect(() => () => contentRequest.current?.abort(), []);

  function closeContent() {
    contentRequest.current?.abort();
    contentRequest.current = null;
    setSelected(null);
    setContent(null);
    setContentError(null);
    setContentLoading(false);
  }

  async function loadContent() {
    if (!selected || contentRequest.current) return;
    const controller = new AbortController();
    contentRequest.current = controller;
    setContentLoading(true);
    setContentError(null);
    try {
      const result = await readLocalArchive<ArchiveContent>({ action: "content", shard: query.shard, offset: selected.offset }, controller.signal, true);
      if (!controller.signal.aborted) setContent(result);
    } catch (reason) {
      if (!controller.signal.aborted) setContentError(reason instanceof Error ? reason.message : "无法读取正文。");
    } finally {
      if (!controller.signal.aborted) {
        setContentLoading(false);
        contentRequest.current = null;
      }
    }
  }

  function download() {
    if (!summary) return;
    const result = { ...summary, scope: "local-read-only-archive", definitions: {
      totalRecords: "所有分片中的索引记录条数，不代表独立测试用例或模型调用次数",
      uniqueRecordIds: "原始记录 ID 去重数，不代表去重后的业务用例数",
      counts: "按索引记录类型计数，Judge 任务与结果不可合并为评测次数",
      provenance: "历史来源未做模型真实性认证；合成夹具不是真实评测",
    } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "local-archive-summary.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <ConfigProvider locale={zhCN} theme={{ token: {
    colorPrimary: "#1554ad", colorText: "#172033", colorTextSecondary: "#475569",
    colorLink: "#1554ad", colorLinkHover: "#12458d", colorLinkActive: "#103b78", borderRadius: 6,
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', controlHeight: 40,
  } }}>
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
        <nav aria-label="平台导航" className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 text-sm">
          <Link href="/" className="font-semibold hover:underline">评测工作台</Link>
          <span aria-current="page" className="font-semibold text-blue-800">历史归档</span>
          <Link href="/observability" className="text-slate-600 hover:underline">Agent 观测</Link>
          <Link href="/assistant-tools" className="text-slate-600 hover:underline">助手工具</Link>
          <span className="ml-auto text-xs text-slate-600">本机只读 · 不启动评价</span>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-8">
        <section aria-labelledby="archive-title">
          <p className="mb-2 text-xs font-semibold tracking-wider text-slate-600">HISTORY / 本地结果演示</p>
          <h1 id="archive-title" className="text-2xl font-semibold sm:text-3xl">历史归档工作台</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">连接已有跑批记录，从总量到单条逐步核对。原文件不复制、不修改；不会把历史结果变成新的测试任务。</p>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            {summary?.provenance === "synthetic" ? "当前为合成测试夹具，不是真实业务或模型评测。" : "历史来源未认证：索引数量核对不等于模型质量验证，可能包含模拟或重复记录。"}
            不推断标准答案，不生成虚假的成功率、Token 或成本。
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button disabled={!summary || loading || !!error} onClick={download}>下载统计摘要 JSON</Button>
            <Button disabled={loading} onClick={() => setRevision((value) => value + 1)}>重试读取</Button>
          </div>
          <p role="status" className="mt-3 text-sm leading-6 text-slate-600">
            {loading ? "正在核对本机归档，首次需顺序读取所有索引分片；不会加载全部正文到页面…" : error ? "归档未能完成读取，未修改源文件。" : "只读连接完成。下方只加载当前页，正文默认隐藏。"}
          </p>
          {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
        </section>

        {summary && <>
          <section aria-label="全局归档摘要" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["索引记录总数", number(summary.totalRecords), "不是独立用例数，也不是模型调用数"],
              ["原始 ID 去重数", number(summary.uniqueRecordIds), "ID 可能跨分片重复；表格用分片与位置定位"],
              ["已核对分片", number(summary.shardCount), `索引 ${(summary.indexBytes / 1024 / 1024).toFixed(1)} MiB；每页最多 50 条`],
            ].map(([label, value, hint]) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-600">{label}</p><p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
              <p className="mt-2 text-xs leading-6 text-slate-600">{hint}</p>
            </div>)}
          </section>
          <section aria-labelledby="archive-counts" className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 id="archive-counts" className="text-base font-semibold">记录构成</h2>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">{ARCHIVE_TYPES.map((type) => <Tag key={type}>{type}：{number(summary.counts[type])}</Tag>)}</div>
            <p className="mt-3 text-xs leading-6 text-slate-600">核对时间：{new Date(summary.verifiedAt).toLocaleString("zh-CN")}。统计来自分片内容，不直接采用旧清单汇总。</p>
            {summary.manifestCountDelta !== null && summary.manifestCountDelta !== 0 && <p className="mt-2 text-sm text-amber-900">发现旧清单汇总偏差：清单比实际记录{summary.manifestCountDelta > 0 ? "多" : "少"} {number(Math.abs(summary.manifestCountDelta))} 条。以上以本次核对为准。</p>}
          </section>
          <section aria-labelledby="archive-records" className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
            <h2 id="archive-records" className="text-base font-semibold">记录浏览</h2>
            <p className="my-3 text-xs leading-6 text-slate-600">筛选仅作用于当前分片，不是全局搜索。模型原名、原始路径和正文默认不返回；模型别名不代表彻底匿名化。</p>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">分片
                <select aria-label="分片" className="max-w-full rounded border border-slate-300 bg-white p-2" value={query.shard} disabled={loading}
                  onChange={(event) => { closeContent(); setQuery({ ...query, shard: Number(event.target.value), page: 1 }); }}>
                  {Array.from({ length: summary.shardCount }, (_, index) => <option key={index} value={index}>{index + 1} / {summary.shardCount}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2">当前分片类别
                <select aria-label="当前分片类别" className="rounded border border-slate-300 bg-white p-2" value={query.type} disabled={loading}
                  onChange={(event) => { closeContent(); setQuery({ ...query, type: event.target.value, page: 1 }); }}>
                  <option value="">全部类别</option>{ARCHIVE_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
            </div>
            <Table<ArchiveRow> size="small" rowKey="key" dataSource={page?.rows ?? []} pagination={false} loading={loading}
              scroll={{ x: 800 }} locale={{ emptyText: error ? "读取失败，请重试。" : "当前分片没有符合条件的记录。" }}
              columns={[
                { title: "位置", dataIndex: "offset", render: (offset: number) => offset + 1 },
                { title: "记录类型", dataIndex: "type" }, { title: "模型别名", dataIndex: "modelAlias" },
                { title: "历史状态", dataIndex: "status" },
                { title: "索引内容", render: (_, row) => `${row.hasPrompt ? "有输入" : "未收录输入"} / ${row.hasOutput ? "有输出" : "未收录输出"}` },
                { title: "证据引用", render: (_, row) => row.hasEvidence ? "已记录哈希" : "未记录" },
                { title: "操作", render: (_, row) => <Button type="link" onClick={() => setSelected(row)} aria-label={`查看第 ${row.offset + 1} 条索引正文`}>查看正文</Button> },
              ]} />
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <Button disabled={loading || !page || query.page === 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}>上一页</Button>
              <span aria-live="polite">{page ? `第 ${page.page} / ${Math.max(1, Math.ceil(page.matchingInShard / 50))} 页 · 当前分片匹配 ${number(page.matchingInShard)} / ${number(page.totalInShard)} 条` : "等待当前页"}</span>
              <Button disabled={loading || !page || page.page * 50 >= page.matchingInShard} onClick={() => setQuery({ ...query, page: query.page + 1 })}>下一页</Button>
            </div>
          </section>
        </>}
        <details className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
          <summary className="cursor-pointer font-semibold">演示顺序与能力边界</summary>
          <div className="mt-3 space-y-2 leading-7 text-slate-600">
            <p>1. 解释总量口径和清单偏差。2. 选择分片与类别。3. 确认隐私提示后查看单条。4. 下载无正文的统计摘要。</p>
            <p>本页只连接已配置的本机目录。迁移时重新配置目录，不把机器路径或业务数据提交到仓库。服务须绑定 127.0.0.1，不面向公网。</p>
            <p>未开发：全局全文搜索、完整证据文件查看、新任务导入、后台任务与 20GB 数据执行。空正文表示索引未收录，不代表原模型没有回答。</p>
          </div>
        </details>
      </main>
      <Modal open={!!selected} title="查看本机索引正文" onCancel={closeContent} footer={null} destroyOnHidden>
        {!content ? <div className="space-y-4">
          <p>正文可能包含业务或个人信息。常见密钥会自动脱敏，但不能保证清除全部敏感内容；演示或共享屏幕前请确认适合展示。</p>
          <p>仅读取当前一条，不加载图片，不访问外部链接，也不启动评价。</p>
          {contentError && <p role="alert" className="text-red-800">{contentError}</p>}
          <Button type="primary" loading={contentLoading} onClick={loadContent}>我确认，只在本机查看此条</Button>
          <Button className="ml-2" aria-label="取消" onClick={closeContent}>取消</Button>
        </div> : <div className="space-y-4">
          {([["输入", content.prompt], ["模型输出（非标准答案）", content.output], ["历史说明", content.reason]] as const).map(([label, value]) => <section key={label}>
            <h3 className="mb-2 font-semibold">{label}</h3>
            <p className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-slate-800">{value ?? "索引未收录此内容，不能据此判定任务失败。"}</p>
          </section>)}
          {content.truncated && <p className="text-amber-900">长文本仅展示脱敏后的前 6,000 字符，原文件未截断。</p>}
          <p className="break-all text-xs text-slate-600">{content.evidence ? `证据索引：${content.evidence.hash}；行号：${content.evidence.line ?? "未记录"}。尚未读取证据文件。` : "未记录证据引用。"}</p>
          <Button onClick={closeContent}>关闭正文</Button>
        </div>}
      </Modal>
    </div>
  </ConfigProvider>;
}
