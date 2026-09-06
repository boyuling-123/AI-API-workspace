"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "antd";
import { summarizeAgentExperiment, type AgentExperiment } from "@/lib/agentObservability";
import { OBSERVATION_FILE_ERROR, OBSERVATION_READ_ERROR, readPortableAgentExperiment } from "@/lib/portableAgentExperiment";

export function ObservationFileImport({ disabled, hasResult, onConfirm, onBusyChange }: {
  disabled: boolean;
  hasResult: boolean;
  onConfirm: (experiment: AgentExperiment) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [candidate, setCandidate] = useState<AgentExperiment | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { requestId.current++; }, []);

  function cancel() {
    requestId.current++;
    setCandidate(null);
    setReading(false);
    setError(null);
    onBusyChange(false);
  }

  async function select(file?: File) {
    if (!file || disabled || reading || candidate) return;
    const id = ++requestId.current;
    setError(null);
    setReading(true);
    onBusyChange(true);
    try {
      const result = await readPortableAgentExperiment(file);
      if (requestId.current !== id) return;
      setCandidate(result);
    } catch (reason) {
      if (requestId.current !== id) return;
      setError(reason instanceof Error && reason.message === OBSERVATION_READ_ERROR ? OBSERVATION_READ_ERROR : OBSERVATION_FILE_ERROR);
      onBusyChange(false);
    } finally {
      if (requestId.current === id) setReading(false);
    }
  }

  return <section aria-labelledby="observation-import-title" className="rounded-lg border border-slate-200 bg-white p-5">
    <h2 id="observation-import-title" className="text-base font-semibold">重新打开本机观测文件</h2>
    <p id="observation-import-help" className="mt-2 text-sm leading-6 text-slate-600">
      仅支持本平台下载的完整 Mock 实验 JSON（版本 1，最多 64 KiB）。先预览再确认，不上传、不重跑、不写入项目数据库。不是数据集导入或通用 Agent 接入。
    </p>
    <label htmlFor="observation-file" className="mt-4 block text-sm font-medium">选择观测 JSON 文件</label>
    <input ref={inputRef} id="observation-file" type="file" accept=".json,application/json" aria-describedby="observation-import-help"
      disabled={disabled || reading || Boolean(candidate)}
      className="hidden"
      onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void select(file); }} />
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <Button disabled={disabled || reading || Boolean(candidate)} onClick={() => inputRef.current?.click()}>选择本机 JSON 文件</Button>
      <span className="text-sm text-slate-600">{candidate ? "文件已校验，等待确认" : reading ? "正在读取文件" : "请选择要回读的文件"}</span>
    </div>
    {reading && <p role="status" aria-label="文件读取状态" className="mt-3 text-sm text-slate-700">正在本机读取并校验，当前结果不会被替换。</p>}
    {error && <p role="alert" aria-label="观测文件错误" className="mt-3 text-sm leading-6 text-red-800">{error}</p>}
    {candidate && <div role="region" aria-label="观测文件预览" className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
      <h3 className="font-semibold">校验通过，等待确认</h3>
      <p>外部文件回读，来源未认证。格式正确不代表内容真实，也不能证明文件来自某次执行。</p>
      <p>文件声明：{candidate.source === "local-langgraph-mock-otel" ? "LangGraph 1.4.14 / Mock 节点" : "本地模拟流程 / 手动 OTel 埋点"}；格式版本 {candidate.schemaVersion}；OTel SDK {candidate.instrumentation.version}。</p>
      <p>{summarizeAgentExperiment(candidate).length} 条调用链 / {candidate.spans.length} 个步骤。Token 和成本均未测量；不会运行模型。</p>
      <p>{hasResult ? "确认后替换当前页面结果和选中的调用链；原结果尚未更改，可先下载保留。" : "确认后在下方显示结果和调用链。"}离开页面即清空，不修改任何项目或归档。</p>
    </div>}
    {(candidate || reading) && <div className="mt-4 flex flex-wrap gap-3">
      {candidate && <Button type="primary" onClick={() => { onConfirm(candidate); cancel(); }}>确认加载观测文件</Button>}
      <Button onClick={cancel}>取消回读，保留当前结果</Button>
    </div>}
  </section>;
}
