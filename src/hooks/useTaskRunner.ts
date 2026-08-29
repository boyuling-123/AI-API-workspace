"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  ContentMode,
  ResultItem,
  ResultRow,
  RunPolicy,
  TargetConfig,
  Task,
  TaskInput,
} from "@/types";
import { runTargets } from "@/services/runService";
import { emitPetStatus } from "@/lib/petBus";
import {
  createCheckpointRows,
  getRunProgress,
  replaceCheckpointItem,
  type RunProgress,
} from "@/lib/batchCheckpoint";
import { computeTaskStatus } from "@/lib/taskStatus";
import { generateId } from "@/lib/id";
import { normalizeRunPolicy } from "@/lib/runPolicy";

export type RunMode = "idle" | "trial" | "batch";
export type RunStatus = "idle" | "running" | "paused" | "done" | "cancelled";

const CHECKPOINT_ITEM_INTERVAL = 10;

interface BatchContext {
  contentMode: ContentMode;
  task?: Task;
}

type StopReason = "paused" | "cancelled" | null;

export interface UseTaskRunnerOptions {
  /** 每个一致检查点都更新同一 Task；调用方负责立即持久化。 */
  onBatchSnapshot?: (task: Task) => void;
  /** 全部目标配置（含预置 + 用户接入），用于运行分发。 */
  targetConfigs?: TargetConfig[];
}

export interface UseTaskRunnerResult {
  results: ResultRow[];
  progress: RunProgress;
  runStatus: RunStatus;
  lastRunMode: RunMode;
  runTrial: (
    inputs: TaskInput[],
    targetIds: string[],
    concurrency: number,
    runPolicy: RunPolicy
  ) => void;
  runBatch: (
    inputs: TaskInput[],
    targetIds: string[],
    concurrency: number,
    contentMode: ContentMode,
    runPolicy: RunPolicy
  ) => void;
  resumeBatch: (task: Task) => void;
  pause: () => void;
  cancel: () => void;
  clear: () => void;
}

/**
 * 运行状态管理。批量运行按固定间隔写检查点；暂停后可从原 Task 续跑，
 * 已完成的 Case x target 不会重复请求。终止与暂停语义分离。
 */
export function useTaskRunner(
  options: UseTaskRunnerOptions = {}
): UseTaskRunnerResult {
  const onBatchSnapshotRef = useRef(options.onBatchSnapshot);
  onBatchSnapshotRef.current = options.onBatchSnapshot;
  const targetConfigsRef = useRef(options.targetConfigs);
  targetConfigsRef.current = options.targetConfigs;
  const [results, setResults] = useState<ResultRow[]>([]);
  const resultsRef = useRef<ResultRow[]>([]);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [lastRunMode, setLastRunMode] = useState<RunMode>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const stopReasonRef = useRef<StopReason>(null);

  const execute = useCallback(
    async (
      inputs: TaskInput[],
      targetIds: string[],
      concurrency: number,
      runPolicy: RunPolicy,
      mode: RunMode,
      batchContext?: BatchContext
    ) => {
      if (
        inputs.length === 0 ||
        targetIds.length === 0 ||
        abortRef.current !== null
      ) {
        return;
      }

      const targetConfigs = targetConfigsRef.current ?? [];
      const previousTask = batchContext?.task;
      const normalizedPolicy = normalizeRunPolicy(
        previousTask?.runPolicy ?? runPolicy
      );
      const initialRows = createCheckpointRows(
        inputs,
        targetIds,
        targetConfigs,
        previousTask?.results
      );
      const taskBase: Task | null =
        mode === "batch" && batchContext
          ? {
              ...(previousTask ?? {}),
              id: previousTask?.id ?? generateId(),
              createTime: previousTask?.createTime ?? Date.now(),
              contentMode: batchContext.contentMode,
              runMode: "batch",
              inputs,
              targetIds,
              concurrency,
              runPolicy: normalizedPolicy,
              paramSnapshot:
                previousTask?.paramSnapshot ??
                targetConfigs
                  .filter((target) => targetIds.includes(target.id))
                  .map((target) => ({
                    targetId: target.id,
                    paramDefs: target.inputParams,
                  })),
              results: initialRows,
              status: "running",
            }
          : null;

      const emitSnapshot = (
        status: Task["status"],
        snapshotResults: ResultRow[],
        finished: boolean
      ) => {
        if (!taskBase) return;
        const progress = getRunProgress(snapshotResults);
        onBatchSnapshotRef.current?.({
          ...taskBase,
          finishTime: finished ? Date.now() : undefined,
          results: snapshotResults,
          checkpoint: {
            completedCalls: progress.completedCalls,
            totalCalls: progress.totalCalls,
            updatedTime: Date.now(),
          },
          status,
        });
      };

      const controller = new AbortController();
      abortRef.current = controller;
      stopReasonRef.current = null;
      setLastRunMode(mode);
      setRunStatus("running");
      resultsRef.current = initialRows;
      setResults(initialRows);
      emitPetStatus({ status: "busy", scene: "run" });
      if (mode === "batch") {
        emitSnapshot("running", initialRows, false);
      }

      let itemsSinceCheckpoint = 0;
      const applyItem = (inputId: string, item: ResultItem) => {
        const next = replaceCheckpointItem(resultsRef.current, inputId, item);
        resultsRef.current = next;
        setResults(next);
        if (mode === "batch") {
          itemsSinceCheckpoint += 1;
          if (itemsSinceCheckpoint >= CHECKPOINT_ITEM_INTERVAL) {
            itemsSinceCheckpoint = 0;
            emitSnapshot("running", next, false);
          }
        }
      };

      try {
        const finalResults = await runTargets({
          inputs,
          targetIds,
          concurrency,
          runPolicy: normalizedPolicy,
          targetConfigs,
          existingResults: initialRows,
          signal: controller.signal,
          onItemUpdate: applyItem,
        });
        resultsRef.current = finalResults;
        setResults(finalResults);

        const stopReason = stopReasonRef.current;
        const taskStatus =
          stopReason === "paused"
            ? "paused"
            : stopReason === "cancelled"
              ? "cancelled"
              : computeTaskStatus(finalResults, false);
        setRunStatus(
          stopReason === "paused"
            ? "paused"
            : stopReason === "cancelled"
              ? "cancelled"
              : "done"
        );

        if (mode === "batch") {
          emitSnapshot(taskStatus, finalResults, taskStatus !== "paused");
        }
        if (stopReason) {
          emitPetStatus({ status: "idle" });
        } else {
          const hasFailure = finalResults.some((row) =>
            row.items.some((item) => item.status === "error")
          );
          emitPetStatus({ status: hasFailure ? "sad" : "happy", scene: "run" });
        }
      } catch {
        const stopReason = stopReasonRef.current;
        const taskStatus =
          stopReason === "paused"
            ? "paused"
            : stopReason === "cancelled"
              ? "cancelled"
              : "error";
        setRunStatus(
          stopReason === "paused"
            ? "paused"
            : stopReason === "cancelled"
              ? "cancelled"
              : "done"
        );
        if (mode === "batch") {
          emitSnapshot(taskStatus, resultsRef.current, taskStatus !== "paused");
        }
        emitPetStatus(
          stopReason
            ? { status: "idle" }
            : { status: "sad", scene: "run" }
        );
      } finally {
        abortRef.current = null;
        stopReasonRef.current = null;
      }
    },
    []
  );

  const runTrial = useCallback(
    (
      inputs: TaskInput[],
      targetIds: string[],
      concurrency: number,
      runPolicy: RunPolicy
    ) => {
      void execute(
        inputs.slice(0, 1),
        targetIds,
        concurrency,
        runPolicy,
        "trial"
      );
    },
    [execute]
  );

  const runBatch = useCallback(
    (
      inputs: TaskInput[],
      targetIds: string[],
      concurrency: number,
      contentMode: ContentMode,
      runPolicy: RunPolicy
    ) => {
      void execute(inputs, targetIds, concurrency, runPolicy, "batch", {
        contentMode,
      });
    },
    [execute]
  );

  const resumeBatch = useCallback(
    (task: Task) => {
      void execute(
        task.inputs,
        task.targetIds,
        task.concurrency,
        normalizeRunPolicy(task.runPolicy),
        "batch",
        {
          contentMode: task.contentMode,
          task,
        }
      );
    },
    [execute]
  );

  const pause = useCallback(() => {
    if (!abortRef.current) return;
    stopReasonRef.current = "paused";
    abortRef.current.abort();
  }, []);

  const cancel = useCallback(() => {
    if (!abortRef.current) return;
    stopReasonRef.current = "cancelled";
    abortRef.current.abort();
  }, []);

  const clear = useCallback(() => {
    resultsRef.current = [];
    setResults([]);
    setRunStatus("idle");
    setLastRunMode("idle");
  }, []);

  const progress = useMemo(() => getRunProgress(results), [results]);

  return {
    results,
    progress,
    runStatus,
    lastRunMode,
    runTrial,
    runBatch,
    resumeBatch,
    pause,
    cancel,
    clear,
  };
}
