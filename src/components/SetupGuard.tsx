"use client";

import { useCallback, useState } from "react";
import type {
  BaseModelConfig,
  BaseModelProtocol,
  ModelEndpoint,
} from "@/types";

interface SetupGuardProps {
  onComplete: (endpoint: ModelEndpoint) => void;
}

type VerifyStatus = "idle" | "verifying" | "success" | "error";

/**
 * 首次使用引导页：全屏展示，用户填入基础大模型配置（BaseURL / API Key / Model Name），
 * 验证通过后自动存为第一个 base-model endpoint，进入主界面。
 * 已有 base-model 的用户不会看到此页面（由 AppShell 判断）。
 */
export function SetupGuard({ onComplete }: SetupGuardProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelAlias, setModelAlias] = useState("");
  const [protocol, setProtocol] = useState<BaseModelProtocol>("auto");
  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const canSubmit =
    baseUrl.trim().length > 0 &&
    apiKey.trim().length > 0 &&
    modelName.trim().length > 0 &&
    status !== "verifying";

  const handleVerify = useCallback(async () => {
    if (!canSubmit) return;

    setStatus("verifying");
    setErrorMessage("");

    const config: BaseModelConfig = {
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      modelName: modelName.trim(),
      protocol,
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseModel: config,
          prompt: "你好，请回复一个字：好",
        }),
        signal: AbortSignal.timeout(30000),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? `验证失败（HTTP ${response.status}）`);
      }

      if (!data.outputText && data.outputText !== "") {
        throw new Error("模型返回了空响应，请检查配置是否正确");
      }

      setStatus("success");

      // 构造 ModelEndpoint 并回调上层存入项目
      const endpointId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `bm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const endpoint: ModelEndpoint = {
        id: endpointId,
        name: modelAlias.trim() || modelName.trim(),
        kind: "base-model",
        capability: "text",
        supportsToolUse: true,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        modelName: config.modelName,
        protocol: config.protocol,
        status: "tested_ok",
      };

      // 短暂展示成功状态后进入主界面
      setTimeout(() => onComplete(endpoint), 600);
    } catch (error) {
      setStatus("error");
      if (error instanceof DOMException && error.name === "TimeoutError") {
        setErrorMessage("请求超时（30秒），请检查 Base URL 是否可访问");
      } else {
        setErrorMessage(
          error instanceof Error ? error.message : "验证失败，请检查配置"
        );
      }
    }
  }, [canSubmit, baseUrl, apiKey, modelName, modelAlias, onComplete, protocol]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <div className="w-full max-w-lg">
        {/* 标题区 */}
        <div className="mb-8 text-center">
          <div className="mb-4 text-5xl">🐶</div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            欢迎使用评测平台
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            首次使用需要配置一个基础大模型，作为平台 AI 功能的驱动源
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            配置仅存在本地浏览器中，不会上传到任何服务器
          </p>
        </div>

        {/* 配置表单 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-4">
            {/* Base URL */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="setup-base-url"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Base URL
              </label>
              <input
                id="setup-base-url"
                type="url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://dashscope.aliyuncs.com/compatible-mode"
                disabled={status === "verifying" || status === "success"}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-500"
              />
              <span className="text-xs text-slate-400">
                模型 API 的网关地址（OpenAI / Anthropic 兼容协议）
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="setup-protocol"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                协议类型
              </label>
              <select
                id="setup-protocol"
                value={protocol}
                onChange={(event) =>
                  setProtocol(event.target.value as BaseModelProtocol)
                }
                disabled={status === "verifying" || status === "success"}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              >
                <option value="auto">自动探测（推荐）</option>
                <option value="openai">OpenAI Compatible</option>
                <option value="anthropic">Anthropic Compatible</option>
              </select>
              <span className="text-xs text-slate-400">
                auto 会按地址特征自动尝试两套协议，探测到可用的就使用
              </span>
            </div>

            {/* API Key */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="setup-api-key"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                API Key
              </label>
              <input
                id="setup-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxx"
                disabled={status === "verifying" || status === "success"}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-500"
              />
              <span className="text-xs text-slate-400">
                仅存本地浏览器，不会上传
              </span>
            </div>

            {/* Model Name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="setup-model-name"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Model Name
              </label>
              <input
                id="setup-model-name"
                type="text"
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                placeholder="qwen-max / deepseek-chat / gpt-4o"
                disabled={status === "verifying" || status === "success"}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-500"
              />
              <span className="text-xs text-slate-400">
                实际调用的模型标识
              </span>
            </div>

            {/* 别名（可选） */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="setup-alias"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                显示名称
                <span className="ml-1 text-xs font-normal text-slate-400">
                  （选填）
                </span>
              </label>
              <input
                id="setup-alias"
                type="text"
                value={modelAlias}
                onChange={(event) => setModelAlias(event.target.value)}
                placeholder="留空则使用 Model Name"
                disabled={status === "verifying" || status === "success"}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-500"
              />
            </div>
          </div>

          {/* 错误提示 */}
          {status === "error" && errorMessage && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          {/* 成功提示 */}
          {status === "success" && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300">
              ✅ 验证通过！正在进入主界面…
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="button"
            onClick={handleVerify}
            disabled={!canSubmit || status === "success"}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            {status === "verifying" ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                正在验证连接…
              </>
            ) : status === "success" ? (
              "验证通过 ✓"
            ) : (
              "验证并开始使用"
            )}
          </button>
        </div>

        {/* 底部说明 */}
        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          验证会向模型发送一条简单消息确认连通性 · 进入后可在「接口管理」中修改或添加更多模型
        </p>
      </div>
    </div>
  );
}
