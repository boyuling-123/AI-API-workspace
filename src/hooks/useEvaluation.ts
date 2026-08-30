"use client";

import { useCallback, useRef, useState } from "react";
import type {
  EvalDimension,
  EvaluationMode,
  ResultRow,
  TaskInput,
} from "@/types";
import type { EvaluateResultPerInput } from "@/services/evaluateService";
import { runEvaluation } from "@/services/evaluateClient";
import { generateEvalPromptClient } from "@/services/evalPromptClient";
import { generateDimensionsClient } from "@/services/genDimensionsClient";
import { emitPetStatus } from "@/lib/petBus";
import type { DimensionGenerationRequest } from "@/lib/dimensionGeneration";

export type EvalStatus =
  | "idle"
  | "gen-dim"
  | "generating"
  | "running"
  | "done"
  | "error";

export interface EvaluationItemError {
  inputId: string;
  message: string;
}

export interface UseEvaluationResult {
  evalResults: EvaluateResultPerInput[];
  itemErrors: EvaluationItemError[];
  status: EvalStatus;
  error: string | null;
  genDimensions: (
    request: DimensionGenerationRequest,
    modelId: string
  ) => Promise<EvalDimension[]>;
  generatePrompt: (
    scenario: string,
    modelId: string,
    dimensions: EvalDimension[],
    targetNames: string[]
  ) => Promise<string>;
  evaluate: (params: {
    inputs: TaskInput[];
    results: ResultRow[];
    scopeInputIds?: string[];
    evalPrompt: string;
    modelId: string;
    dimensions: EvalDimension[];
    evaluationMode?: EvaluationMode;
    expectedAnswerKey?: string;
    concurrency: number;
  }) => Promise<EvaluateResultPerInput[]>;
  cancel: () => void;
  clear: () => void;
}

/**
 * AI 评价状态管理（M9）：生成评价 prompt、逐条评价、取消、清理。
 * 评价并发复用通用 Task Runner（在 evaluateClient 内），由 concurrency 管控。
 */
export function useEvaluation(): UseEvaluationResult {
  const [evalResults, setEvalResults] = useState<EvaluateResultPerInput[]>([]);
  const [itemErrors, setItemErrors] = useState<EvaluationItemError[]>([]);
  const [status, setStatus] = useState<EvalStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const genDimensions = useCallback<UseEvaluationResult["genDimensions"]>(
    async (request, modelId) => {
      setStatus("gen-dim");
      setError(null);
      try {
        const dimensions = await generateDimensionsClient(
          request,
          modelId
        );
        setStatus("idle");
        return dimensions;
      } catch (err) {
        setStatus("error");
        const message = err instanceof Error ? err.message : "生成维度失败";
        setError(message);
        throw err;
      }
    },
    []
  );

  const generatePrompt = useCallback<UseEvaluationResult["generatePrompt"]>(
    async (scenario, modelId, dimensions, targetNames): Promise<string> => {
      setStatus("generating");
      setError(null);
      try {
        const prompt = await generateEvalPromptClient(
          scenario,
          modelId,
          dimensions,
          targetNames
        );
        setStatus("idle");
        return prompt;
      } catch (err) {
        setStatus("error");
        const message = err instanceof Error ? err.message : "生成失败";
        setError(message);
        throw err;
      }
    },
    []
  );

  const evaluate = useCallback<UseEvaluationResult["evaluate"]>(
    async ({
      inputs,
      results,
      scopeInputIds,
      evalPrompt,
      modelId,
      dimensions,
      evaluationMode,
      expectedAnswerKey,
      concurrency,
    }) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("running");
      setError(null);
      setEvalResults([]);
      setItemErrors([]);
      // 彩蛋：评价开始 → 宠物忙碌（只读状态、不影响业务）。
      emitPetStatus({ status: "busy", scene: "evaluate" });

      try {
        const collected = await runEvaluation({
          inputs,
          results,
          scopeInputIds,
          evalPrompt,
          modelId,
          dimensions,
          evaluationMode,
          expectedAnswerKey,
          concurrency,
          signal: controller.signal,
          onItemDone: (result) => {
            setEvalResults((prev) => {
              const others = prev.filter((r) => r.inputId !== result.inputId);
              return [...others, result];
            });
          },
          onItemError: (inputId, message) => {
            setError(`输入 ${inputId} 评价失败：${message}`);
            setItemErrors((current) => [
              ...current.filter((item) => item.inputId !== inputId),
              { inputId, message },
            ]);
          },
        });
        // 取消时不回传结果，避免把半截评价存成正式记录。
        if (controller.signal.aborted) {
          setStatus("idle");
          emitPetStatus({ status: "idle" });
          return [];
        }
        setStatus("done");
        emitPetStatus({ status: "happy", scene: "evaluate" });
        return collected;
      } catch {
        setStatus(controller.signal.aborted ? "idle" : "error");
        emitPetStatus(
          controller.signal.aborted
            ? { status: "idle" }
            : { status: "sad", scene: "evaluate" }
        );
        return [];
      } finally {
        abortRef.current = null;
      }
    },
    []
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  const clear = useCallback(() => {
    setEvalResults([]);
    setItemErrors([]);
    setStatus("idle");
    setError(null);
  }, []);

  return {
    evalResults,
    itemErrors,
    status,
    error,
    genDimensions,
    generatePrompt,
    evaluate,
    cancel,
    clear,
  };
}
