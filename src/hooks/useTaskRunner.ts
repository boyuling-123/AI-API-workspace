"use client";

import { useCallback, useRef, useState } from "react";
import type { TargetConfig, ResultItem, ResultRow, TaskInput } from "@/types";
import { runTargets } from "@/services/runService";
import { emitPetStatus } from "@/lib/petBus";

export type RunMode = "idle" | "trial" | "batch";
export type RunStatus = "idle" | "running" | "done" | "cancelled";

export interface RunCompletePayload {
  mode: RunMode;
  inputs: TaskInput[];
  targetIds: string[];
  concurrency: number;
  results: ResultRow[];
  wasCancelled: boolean;
}

export interface UseTaskRunnerOptions {
  /** 批量运行完成时回调（试运行不触发，不落历史）。 */
  onRunComplete?: (payload: RunCompletePayload) => void;
  /** 全部目标配置（含预置 + 用户接入），用于运行分发。 */
  targetConfigs?: TargetConfig[];
}

export interface UseTaskRunnerResult {
  results: ResultRow[];
  runStatus: RunStatus;
  lastRunMode: RunMode;
  runTrial: (inputs: TaskInput[], targetIds: string[], concurrency: number) => void;
  runBatch: (inputs: TaskInput[], targetIds: string[], concurrency: number) => void;
  cancel: () => void;
  clear: () => void;
}

/**
 * 运行状态管理。试运行（仅第1条，结果隔离）与批量运行复用同一执行路径。
 * 取消通过 AbortController：中断已发请求 + 通用并发池跳过排队任务。
 */
export function useTaskRunner(
  options: UseTaskRunnerOptions = {}
): UseTaskRunnerResult {
  const onRunCompleteRef = useRef(options.onRunComplete);
  onRunCompleteRef.current = options.onRunComplete;
  const targetConfigsRef = useRef(options.targetConfigs);
  targetConfigsRef.current = options.targetConfigs;
  const [results, setResults] = useState<ResultRow[]>([]);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [lastRunMode, setLastRunMode] = useState<RunMode>("idle");
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(
    async (
      inputs: TaskInput[],
      targetIds: string[],
      concurrency: number,
      mode: RunMode
    ) => {
      if (inputs.length === 0 || targetIds.length === 0) {
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setLastRunMode(mode);
      setRunStatus("running");
      // 彩蛋：广播"忙碌"给电子宠物（只读状态、不影响业务）。
      emitPetStatus({ status: "busy", scene: "run" });

      const initialRows: ResultRow[] = inputs.map((input) => ({
        inputId: input.id,
        items: targetIds.map((targetId) => ({
          targetId,
          targetName: targetId,
          status: "pending" as const,
        })),
      }));
      setResults(initialRows);

      const applyItem = (inputId: string, item: ResultItem) => {
        setResults((prev) =>
          prev.map((row) => {
            if (row.inputId !== inputId) {
              return row;
            }
            const exists = row.items.some((it) => it.targetId === item.targetId);
            return {
              ...row,
              items: exists
                ? row.items.map((it) =>
                    it.targetId === item.targetId ? item : it
                  )
                : [...row.items, item],
            };
          })
        );
      };

      try {
        const finalResults = await runTargets({
          inputs,
          targetIds,
          concurrency,
          targetConfigs: targetConfigsRef.current,
          signal: controller.signal,
          onItemUpdate: applyItem,
        });
        const wasCancelled = controller.signal.aborted;
        setRunStatus(wasCancelled ? "cancelled" : "done");
        // 彩蛋：根据结果有无失败项给宠物 happy / sad。
        if (!wasCancelled) {
          const hasFailure = finalResults.some((row) =>
            row.items.some(
              (item) => item.status === "error" || item.status === "interrupted"
            )
          );
          emitPetStatus({ status: hasFailure ? "sad" : "happy", scene: "run" });
        } else {
          emitPetStatus({ status: "idle" });
        }

        // 试运行结果隔离、不落历史；仅批量运行回调持久化。
        if (mode === "batch") {
          onRunCompleteRef.current?.({
            mode,
            inputs,
            targetIds,
            concurrency,
            results: finalResults,
            wasCancelled,
          });
        }
      } catch {
        setRunStatus(controller.signal.aborted ? "cancelled" : "done");
        emitPetStatus(
          controller.signal.aborted
            ? { status: "idle" }
            : { status: "sad", scene: "run" }
        );
      } finally {
        abortRef.current = null;
      }
    },
    []
  );

  const runTrial = useCallback(
    (inputs: TaskInput[], targetIds: string[], concurrency: number) => {
      const firstInput = inputs.slice(0, 1);
      execute(firstInput, targetIds, concurrency, "trial");
    },
    [execute]
  );

  const runBatch = useCallback(
    (inputs: TaskInput[], targetIds: string[], concurrency: number) => {
      execute(inputs, targetIds, concurrency, "batch");
    },
    [execute]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setRunStatus("cancelled");
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setRunStatus("idle");
    setLastRunMode("idle");
  }, []);

  return {
    results,
    runStatus,
    lastRunMode,
    runTrial,
    runBatch,
    cancel,
    clear,
  };
}
