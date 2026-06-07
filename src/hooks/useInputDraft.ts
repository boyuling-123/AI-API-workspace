"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentMode, RunMode, TaskInput } from "@/types";
import { buildDraftKey, getDraft, saveDraft } from "@/services/draftDb";
import { generateId } from "@/lib/id";

const AUTO_SAVE_DEBOUNCE_MS = 600;

export function createEmptyInput(): TaskInput {
  return { id: generateId(), prompt: "", images: [] };
}

/** 四套草稿在内存中的形态：单条存 1 条，批量存数组。 */
interface DraftBucket {
  single: TaskInput;
  batch: TaskInput[];
}

function emptyBucket(): DraftBucket {
  return { single: createEmptyInput(), batch: [] };
}

function bucketKey(contentMode: ContentMode): "text" | "image" {
  return contentMode;
}

export interface UseInputDraftResult {
  contentMode: ContentMode;
  setContentMode: (mode: ContentMode) => void;
  runMode: RunMode;
  setRunMode: (mode: RunMode) => void;
  /** 兼容旧字段：runMode 的别名。 */
  mode: RunMode;
  setMode: (mode: RunMode) => void;
  singleInput: TaskInput;
  batchInputs: TaskInput[];
  updateSingleInput: (updater: (current: TaskInput) => TaskInput) => void;
  setBatchInputs: (inputs: TaskInput[]) => void;
  isReady: boolean;
}

/**
 * ContentMode（text/image）× RunMode（single/batch）四套草稿隔离管理（v4 M3）。
 * 每套草稿各自持久化到 IndexedDB（draftDb），四个组合任意切换互不覆盖，刷新可恢复。
 */
export function useInputDraft(projectId: string): UseInputDraftResult {
  const [contentMode, setContentModeState] = useState<ContentMode>("text");
  const [runMode, setRunModeState] = useState<RunMode>("single");
  const [buckets, setBuckets] = useState<Record<ContentMode, DraftBucket>>({
    text: emptyBucket(),
    image: emptyBucket(),
  });
  const [isReady, setIsReady] = useState(false);

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const loadedProjectId = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId || loadedProjectId.current === projectId) {
      return;
    }
    loadedProjectId.current = projectId;
    setIsReady(false);

    async function loadDrafts() {
      try {
        const combos: { contentMode: ContentMode; runMode: RunMode }[] = [
          { contentMode: "text", runMode: "single" },
          { contentMode: "text", runMode: "batch" },
          { contentMode: "image", runMode: "single" },
          { contentMode: "image", runMode: "batch" },
        ];
        const loaded = await Promise.all(
          combos.map((combo) =>
            getDraft(projectId, combo.contentMode, combo.runMode)
          )
        );
        const next: Record<ContentMode, DraftBucket> = {
          text: emptyBucket(),
          image: emptyBucket(),
        };
        combos.forEach((combo, index) => {
          const draft = loaded[index];
          const bucket = next[combo.contentMode];
          if (combo.runMode === "single") {
            bucket.single = draft?.inputs[0] ?? createEmptyInput();
          } else {
            bucket.batch = draft?.inputs ?? [];
          }
        });
        setBuckets(next);
      } catch (error) {
        console.error("加载输入草稿失败：", error);
        setBuckets({ text: emptyBucket(), image: emptyBucket() });
      } finally {
        setIsReady(true);
      }
    }
    loadDrafts();
  }, [projectId]);

  const persist = useCallback(
    (cMode: ContentMode, rMode: RunMode, inputs: TaskInput[]) => {
      const key = buildDraftKey(projectId, cMode, rMode);
      if (timers.current[key]) {
        clearTimeout(timers.current[key]);
      }
      timers.current[key] = setTimeout(() => {
        saveDraft({
          key,
          projectId,
          contentMode: cMode,
          runMode: rMode,
          inputs,
          updateTime: Date.now(),
        }).catch((error) => console.error("保存草稿失败：", error));
      }, AUTO_SAVE_DEBOUNCE_MS);
    },
    [projectId]
  );

  const updateSingleInput = useCallback(
    (updater: (current: TaskInput) => TaskInput) => {
      const cMode = contentMode;
      setBuckets((prev) => {
        const bucket = prev[bucketKey(cMode)];
        const next = updater(bucket.single);
        persist(cMode, "single", [next]);
        return { ...prev, [cMode]: { ...bucket, single: next } };
      });
    },
    [contentMode, persist]
  );

  const setBatchInputs = useCallback(
    (inputs: TaskInput[]) => {
      const cMode = contentMode;
      setBuckets((prev) => {
        const bucket = prev[bucketKey(cMode)];
        persist(cMode, "batch", inputs);
        return { ...prev, [cMode]: { ...bucket, batch: inputs } };
      });
    },
    [contentMode, persist]
  );

  const setContentMode = useCallback((next: ContentMode) => {
    setContentModeState(next);
  }, []);

  const setRunMode = useCallback((next: RunMode) => {
    setRunModeState(next);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      Object.values(pending).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const currentBucket = buckets[bucketKey(contentMode)];

  return {
    contentMode,
    setContentMode,
    runMode,
    setRunMode,
    mode: runMode,
    setMode: setRunMode,
    singleInput: currentBucket.single,
    batchInputs: currentBucket.batch,
    updateSingleInput,
    setBatchInputs,
    isReady,
  };
}
