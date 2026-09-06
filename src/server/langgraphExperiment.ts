import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { parseLangGraphExperiment } from "../lib/langgraphExperiment";
import type { AgentExperiment } from "../lib/agentObservability";

export class ExperimentError extends Error {
  constructor(public code: "BUSY" | "CANCELLED" | "TIMEOUT" | "UNAVAILABLE", public status: number, message: string) { super(message); }
}

export const EXPERIMENT_ENV = Object.freeze({
  NODE_ENV: "production" as const,
  LANGCHAIN_TRACING: "", LANGCHAIN_TRACING_V2: "false", LANGSMITH_TRACING: "false", LANGSMITH_TRACING_V2: "false",
  LANGCHAIN_CALLBACKS_BACKGROUND: "false",
});

/** A single fixed local operation; no caller-supplied script, state, arguments, or environment. */
export function createLangGraphRunner(launch: typeof spawn = spawn, timeoutMs = 10_000) {
  let busy = false;
  return async (signal?: AbortSignal): Promise<AgentExperiment> => {
    if (signal?.aborted) throw new ExperimentError("CANCELLED", 499, "本地实验已停止，之前完成的结果保留。");
    if (busy) throw new ExperimentError("BUSY", 409, "另一个框架实验正在运行，请稍后重试。");
    busy = true;
    try {
      return await new Promise<AgentExperiment>((resolve, reject) => {
        let child: ChildProcess;
        let output = "";
        let bytes = 0;
        let failure: ExperimentError | undefined;
        const unavailable = () => new ExperimentError("UNAVAILABLE", 503, "框架实验暂不可用，请重试；仍失败时运行 npm run langgraph:build 后重启平台。");
        try {
          child = launch(process.execPath, [path.resolve(".langgraph-dist/langgraph/stdio.js")], {
            env: { ...EXPERIMENT_ENV }, stdio: ["ignore", "pipe", "ignore"], windowsHide: true,
          });
        } catch { reject(unavailable()); return; }
        const stop = (error: ExperimentError) => { failure ??= error; child.kill("SIGKILL"); };
        const onAbort = () => stop(new ExperimentError("CANCELLED", 499, "本地实验已停止，之前完成的结果保留。"));
        const timer = setTimeout(() => stop(new ExperimentError("TIMEOUT", 504, "框架实验超时，已终止本次运行，请重试。")), timeoutMs);
        const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); };
        signal?.addEventListener("abort", onAbort, { once: true });
        if (signal?.aborted) onAbort();
        child.stdout?.setEncoding("utf8");
        child.stdout?.on("data", (chunk: string) => {
          bytes += Buffer.byteLength(chunk);
          if (bytes > 64 * 1024) { stop(unavailable()); return; }
          output += chunk;
        });
        child.once("error", () => { cleanup(); reject(unavailable()); });
        child.once("close", (code) => {
          cleanup();
          if (failure) { reject(failure); return; }
          if (code !== 0) { reject(unavailable()); return; }
          try { resolve(parseLangGraphExperiment(JSON.parse(output))); } catch { reject(unavailable()); }
        });
      });
    } finally { busy = false; }
  };
}

export const runLangGraphExperiment = createLangGraphRunner();
