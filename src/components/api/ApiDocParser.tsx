"use client";

import { useState } from "react";
import type { ApiDocParseResult } from "@/types";
import { parseApiDoc } from "@/services/parseDocClient";

interface ParserModel {
  id: string;
  name: string;
}

interface ApiDocParserProps {
  /** 可用作「解读模型」的列表（从 apiConfigs 中筛选 llm 传入）。 */
  models: ParserModel[];
  /**
   * 应用解读结果回调（需求4）：把解读结果 + 原始文档交给上层，
   * 上层映射成 ApiConfig 草稿并预填新增接入表单。不传则只透出展示、不显示应用按钮。
   */
  onApply?: (result: ApiDocParseResult, rawDoc: string) => void;
}

/**
 * AI 解读 API 文档面板（M8b，需求2/4）：左侧粘贴框 + 模型选择，右侧结构化解读结果。
 * 解读结果透出展示供对照；若上层传入 onApply，则提供「应用解读结果 → 自动建接口」按钮预填表单。
 */
export function ApiDocParser({ models, onApply }: ApiDocParserProps) {
  const [doc, setDoc] = useState("");
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [result, setResult] = useState<ApiDocParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    if (!doc.trim()) {
      setError("请先粘贴 API 对接文档内容");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const parsed = await parseApiDoc(doc, modelId);
      setResult(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "解读失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600">
            粘贴 API 对接文档
          </span>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="ml-auto rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            {models.length === 0 && (
              <option value="">无可用模型</option>
            )}
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={doc}
          onChange={(e) => setDoc(e.target.value)}
          placeholder="把接口文档/示例请求粘贴到这里，AI 会解读出接入所需的关键信息供你对照填写。"
          className="h-64 w-full resize-y rounded-md border border-gray-300 p-3 text-sm"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleParse}
            disabled={loading}
            className="rounded-md bg-black px-4 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "解读中…" : "AI 解读"}
          </button>
          <span className="text-[11px] text-gray-400">
            {onApply
              ? "解读后可一键应用到接入表单，保存前可手动调整"
              : "仅透出参考，不会自动填表"}
          </span>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-gray-600">AI 解读结果</span>
        {result ? (
          <ParseResultView result={result} />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-gray-300 text-xs text-gray-400">
            解读结果将显示在这里
          </div>
        )}
        {result && onApply && (
          <button
            type="button"
            onClick={() => onApply(result, doc)}
            className="flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            应用 AI 解读结果 → 自动建接口
          </button>
        )}
      </div>
    </div>
  );
}

function ParseResultView({ result }: { result: ApiDocParseResult }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-gray-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
          建议类型：{result.contentKind === "image" ? "生图算法" : result.contentKind === "multimodal" ? "多模态" : "文本大模型"}
        </span>
        {result.suggestedKeyRef && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
            建议 key 引用名：{result.suggestedKeyRef}
          </span>
        )}
      </div>

      {result.summary && (
        <p className="text-xs text-gray-600">{result.summary}</p>
      )}

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <InfoCard label="Endpoint" value={result.endpoint} />
        <InfoCard label="请求方法" value={result.method} />
        <InfoCard label="鉴权方式" value={result.authType} />
        <InfoCard label="文本输出路径" value={result.outputTextPath} />
        <InfoCard label="图片输出路径" value={result.outputImagePath} />
      </dl>

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-gray-500">
          请求参数（共 {result.requestParams.length} 个）
        </span>
        {result.requestParams.length === 0 ? (
          <span className="text-xs text-gray-400">未解析出参数</span>
        ) : (
          <ul className="flex flex-col gap-1">
            {result.requestParams.map((param, index) => (
              <li
                key={`${param.name}-${index}`}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs"
              >
                <span className="font-medium">{param.name || "(未命名)"}</span>
                <span className="ml-1 rounded bg-gray-100 px-1 text-[10px] text-gray-500">
                  {param.type}
                </span>
                {param.required && (
                  <span className="ml-1 text-[10px] text-red-500">必填</span>
                )}
                {param.desc && (
                  <span className="ml-1 text-gray-400">— {param.desc}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {result.warnings.length > 0 && (
        <div className="flex flex-col gap-1 rounded border border-amber-200 bg-amber-50 p-2">
          <span className="text-[11px] font-medium text-amber-700">
            需人工核对
          </span>
          <ul className="list-disc pl-4 text-xs text-amber-700">
            {result.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white px-2 py-1.5">
      <dt className="text-[10px] text-gray-400">{label}</dt>
      <dd className="break-all text-xs text-gray-700">
        {value || <span className="text-gray-300">未提供</span>}
      </dd>
    </div>
  );
}
