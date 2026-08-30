import type {
  EvalDimension,
  EvaluationMode,
  EvaluatorVersion,
} from "@/types";
import { generateId } from "@/lib/id";
import {
  buildEvaluatorPolicyFingerprint,
  parseEvaluatorPolicy,
} from "@/lib/evaluatorPolicy";
import { redactSensitiveText } from "@/lib/redactSensitive";

export const MAX_EVALUATOR_NAME_LENGTH = 80;
export const MAX_EVALUATOR_AUTHOR_LENGTH = 40;
export const MAX_EVALUATOR_CHANGE_NOTE_LENGTH = 240;
export const MAX_EVALUATOR_PROMPT_LENGTH = 50_000;

export interface EvaluatorDefinitionDraft {
  evalModelId: string;
  userRequirement: string;
  dimensions: EvalDimension[];
  evalPrompt: string;
  evaluationMode: EvaluationMode;
  expectedAnswerColumn?: string;
}

export interface CreateEvaluatorVersionInput extends EvaluatorDefinitionDraft {
  existingVersions: EvaluatorVersion[];
  evaluatorId?: string;
  id?: string;
  name: string;
  createTime?: number;
  createdBy: string;
  changeNote?: string;
  applicableTaskId: string;
}

interface ParsedEvaluatorDefinition extends EvaluatorDefinitionDraft {
  policyFingerprint: string;
  definitionFingerprint: string;
}

type EvaluatorVersionIntegritySource = Omit<
  EvaluatorVersion,
  "dimensions" | "evalPrompt" | "integrityFingerprint"
>;

function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return `fp1:${(hash >>> 0).toString(16).padStart(8, "0")}:${value.length}`;
}

function requiredText(value: string, label: string, maxLength: number): string {
  const normalized = redactSensitiveText(value.trim());
  if (!normalized) throw new Error(`${label}不能为空`);
  if (normalized.length > maxLength) {
    throw new Error(`${label}不能超过 ${maxLength} 个字符`);
  }
  return normalized;
}

function optionalText(
  value: string | undefined,
  label: string,
  maxLength: number
): string | undefined {
  const normalized = value ? redactSensitiveText(value.trim()) : undefined;
  if (!normalized) return undefined;
  if (normalized.length > maxLength) {
    throw new Error(`${label}不能超过 ${maxLength} 个字符`);
  }
  return normalized;
}

function cloneDimensions(dimensions: EvalDimension[]): EvalDimension[] {
  return dimensions.map((dimension) => ({
    ...dimension,
    scoreLevels: dimension.scoreLevels?.map((level) => ({ ...level })),
    evidenceRequirements: dimension.evidenceRequirements
      ? [...dimension.evidenceRequirements]
      : undefined,
  }));
}

function parseEvaluatorDefinition(
  draft: EvaluatorDefinitionDraft
): ParsedEvaluatorDefinition {
  if (draft.evaluationMode !== "comparison" && draft.evaluationMode !== "reference") {
    throw new Error("评价模式无效");
  }
  const dimensions = parseEvaluatorPolicy(draft.dimensions);
  const evalModelId = requiredText(draft.evalModelId, "裁判模型", 160);
  const userRequirement = requiredText(
    draft.userRequirement,
    "评测目标",
    2_000
  );
  const evalPrompt = requiredText(
    draft.evalPrompt,
    "评价 Prompt",
    MAX_EVALUATOR_PROMPT_LENGTH
  );
  const expectedAnswerColumn =
    draft.evaluationMode === "reference"
      ? requiredText(
          draft.expectedAnswerColumn ?? "auto",
          "标准答案字段",
          160
        )
      : undefined;
  const policyFingerprint = buildEvaluatorPolicyFingerprint(dimensions);
  const definitionFingerprint = fingerprint(
    JSON.stringify({
      evalModelId,
      userRequirement,
      dimensions,
      evalPrompt,
      evaluationMode: draft.evaluationMode,
      expectedAnswerColumn,
    })
  );
  return {
    evalModelId,
    userRequirement,
    dimensions,
    evalPrompt,
    evaluationMode: draft.evaluationMode,
    expectedAnswerColumn,
    policyFingerprint,
    definitionFingerprint,
  };
}

export function buildEvaluatorDefinitionFingerprint(
  draft: EvaluatorDefinitionDraft
): string {
  return parseEvaluatorDefinition(draft).definitionFingerprint;
}

function buildEvaluatorVersionIntegrityFingerprint(
  version: EvaluatorVersionIntegritySource
): string {
  return fingerprint(
    JSON.stringify({
      id: version.id,
      evaluatorId: version.evaluatorId,
      version: version.version,
      name: version.name,
      createTime: version.createTime,
      createdBy: version.createdBy,
      changeNote: version.changeNote,
      applicableTaskId: version.applicableTaskId,
      evalModelId: version.evalModelId,
      userRequirement: version.userRequirement,
      evaluationMode: version.evaluationMode,
      expectedAnswerColumn: version.expectedAnswerColumn,
      policyFingerprint: version.policyFingerprint,
      definitionFingerprint: version.definitionFingerprint,
    })
  );
}

export function createEvaluatorVersion(
  input: CreateEvaluatorVersionInput
): EvaluatorVersion {
  const parsed = parseEvaluatorDefinition(input);
  const name = requiredText(
    input.name,
    "Evaluator 名称",
    MAX_EVALUATOR_NAME_LENGTH
  );
  const createdBy = requiredText(
    input.createdBy,
    "修改人",
    MAX_EVALUATOR_AUTHOR_LENGTH
  );
  const changeNote = optionalText(
    input.changeNote,
    "变更说明",
    MAX_EVALUATOR_CHANGE_NOTE_LENGTH
  );
  const applicableTaskId = requiredText(
    input.applicableTaskId,
    "适用任务",
    160
  );
  const evaluatorId = input.evaluatorId ?? generateId();
  const family = input.existingVersions.filter(
    (version) =>
      version.evaluatorId === evaluatorId && isEvaluatorVersionIntact(version)
  );
  if (input.evaluatorId && family.length === 0) {
    throw new Error("要追加版本的 Evaluator 不存在");
  }
  const version =
    family.reduce((max, item) => Math.max(max, item.version), 0) + 1;
  const id = input.id ?? generateId();
  if (input.existingVersions.some((item) => item.id === id)) {
    throw new Error("Evaluator 版本 id 已存在");
  }
  const snapshot = {
    id,
    evaluatorId,
    version,
    name,
    createTime: input.createTime ?? Date.now(),
    createdBy,
    changeNote,
    applicableTaskId,
    evalModelId: parsed.evalModelId,
    userRequirement: parsed.userRequirement,
    dimensions: cloneDimensions(parsed.dimensions),
    evalPrompt: parsed.evalPrompt,
    evaluationMode: parsed.evaluationMode,
    expectedAnswerColumn: parsed.expectedAnswerColumn,
    policyFingerprint: parsed.policyFingerprint,
    definitionFingerprint: parsed.definitionFingerprint,
  };
  return {
    ...snapshot,
    integrityFingerprint: buildEvaluatorVersionIntegrityFingerprint(snapshot),
  };
}

export function evaluatorVersionMatchesDraft(
  version: EvaluatorVersion,
  draft: EvaluatorDefinitionDraft
): boolean {
  try {
    return (
      version.definitionFingerprint ===
      buildEvaluatorDefinitionFingerprint(draft)
    );
  } catch {
    return false;
  }
}

export function isEvaluatorVersionIntact(version: EvaluatorVersion): boolean {
  if (!evaluatorVersionMatchesDraft(version, version)) return false;
  return (
    version.integrityFingerprint ===
    buildEvaluatorVersionIntegrityFingerprint(version)
  );
}

export function cloneEvaluatorVersionDraft(
  version: EvaluatorVersion
): EvaluatorDefinitionDraft {
  if (!isEvaluatorVersionIntact(version)) {
    throw new Error("Evaluator 版本完整性校验失败，不能加载");
  }
  return {
    evalModelId: version.evalModelId,
    userRequirement: version.userRequirement,
    dimensions: cloneDimensions(version.dimensions),
    evalPrompt: version.evalPrompt,
    evaluationMode: version.evaluationMode,
    expectedAnswerColumn: version.expectedAnswerColumn,
  };
}
