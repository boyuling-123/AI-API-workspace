"use client";

import type { ContentMode, EvalDimension, Project, TaskInput } from "@/types";
import { buildDraftKey, saveDraft, saveTargetSelection } from "@/services/draftDb";
import { createEmptyProject } from "@/services/projectFactory";
import { generateId } from "@/lib/id";

type ImportMode = "batch_only" | "comparison" | "reference";

interface ImportPackageResponse {
  ok: boolean;
  error?: string;
  body?: {
    project_name: string;
    dataset: {
      input: string;
      expected_output: string;
      image_url: string;
      metadata: Record<string, unknown>;
    }[];
    evaluation: {
      mode: ImportMode;
      dimensions: EvalDimension[];
      eval_prompt: string;
    };
    target_hint: {
      content_mode: ContentMode;
      preferred_targets: string[];
    };
  };
  summary?: {
    total: number;
    imported: number;
    skipped: number;
    with_expected_output: number;
    missing_expected_output: number;
  };
  warnings?: string[];
}

export interface ConsumedWorkspaceImport {
  project: Project;
  openPath: string;
  summary: NonNullable<ImportPackageResponse["summary"]>;
  warnings: string[];
}

function rowToInput(
  row: NonNullable<ImportPackageResponse["body"]>["dataset"][number]
): TaskInput {
  const extraFields: Record<string, unknown> = { ...(row.metadata ?? {}) };
  if (row.expected_output) {
    extraFields.expected_output = row.expected_output;
  }
  return {
    id: generateId(),
    prompt: row.input,
    images: row.image_url
      ? [
          {
            id: generateId(),
            name: row.image_url.split("/").pop() ?? "image",
            source: "url",
            value: row.image_url,
          },
        ]
      : [],
    extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
  };
}

function matchPreferredTargets(project: Project, preferred: string[]): string[] {
  if (preferred.length === 0) return [];
  const wanted = new Set(preferred.map((item) => item.trim().toLowerCase()));
  return project.targetConfigs
    .filter(
      (target) =>
        wanted.has(target.id.toLowerCase()) ||
        wanted.has(target.name.toLowerCase())
    )
    .map((target) => target.id);
}

export async function consumeWorkspaceImport(
  importId: string
): Promise<ConsumedWorkspaceImport> {
  const response = await fetch(
    `/api/import-evaluation-workspace?id=${encodeURIComponent(importId)}`
  );
  const data = (await response.json()) as ImportPackageResponse;
  if (!response.ok || !data.ok || !data.body) {
    throw new Error(data.error ?? "导入包读取失败");
  }

  const project = createEmptyProject(data.body.project_name);
  const contentMode = data.body.target_hint.content_mode ?? "text";
  const inputs = data.body.dataset.map(rowToInput);
  const targetIds = matchPreferredTargets(
    project,
    data.body.target_hint.preferred_targets
  );

  await saveDraft({
    key: buildDraftKey(project.id, contentMode, "batch"),
    projectId: project.id,
    contentMode,
    runMode: "batch",
    inputs,
    updateTime: Date.now(),
  });
  if (targetIds.length > 0) {
    await saveTargetSelection(project.id, targetIds);
  }

  const params = new URLSearchParams({
    tab: "run",
    draft_id: importId,
    mode: data.body.evaluation.mode,
    content_mode: contentMode,
  });
  return {
    project,
    openPath: `/?${params.toString()}`,
    summary: data.summary ?? {
      total: inputs.length,
      imported: inputs.length,
      skipped: 0,
      with_expected_output: inputs.filter((input) => input.extraFields?.expected_output).length,
      missing_expected_output: inputs.filter((input) => !input.extraFields?.expected_output).length,
    },
    warnings: data.warnings ?? [],
  };
}
