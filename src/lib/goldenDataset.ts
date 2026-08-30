import type {
  GoldenDatasetCase,
  GoldenDatasetVersion,
  GoldenHumanLabel,
} from "@/types";
import { generateId } from "@/lib/id";
import { redactSensitiveText } from "@/lib/redactSensitive";

export const MAX_GOLDEN_DATASET_NAME_LENGTH = 80;
export const MAX_GOLDEN_DATASET_AUTHOR_LENGTH = 40;
export const MAX_GOLDEN_DATASET_CHANGE_NOTE_LENGTH = 240;
export const MAX_GOLDEN_DATASET_CASES = 5_000;
export const MAX_GOLDEN_CASE_ID_LENGTH = 160;
export const MAX_GOLDEN_CASE_TEXT_LENGTH = 100_000;
export const MAX_GOLDEN_REVIEWER_NOTE_LENGTH = 2_000;

export interface CreateGoldenDatasetVersionInput {
  existingVersions: GoldenDatasetVersion[];
  datasetId?: string;
  id?: string;
  name: string;
  createTime?: number;
  createdBy: string;
  changeNote?: string;
  sourceFileName?: string;
  cases: GoldenDatasetCase[];
}

type GoldenDatasetVersionIntegritySource = Omit<
  GoldenDatasetVersion,
  "cases" | "integrityFingerprint"
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

function parseHumanLabel(value: GoldenHumanLabel): GoldenHumanLabel {
  if (value !== "pass" && value !== "fail") {
    throw new Error("人工标签只能是 pass 或 fail");
  }
  return value;
}

function parseHumanScore(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0 || value > 10) {
    throw new Error("人工分数必须在 0 到 10 之间");
  }
  return value;
}

function parseCases(cases: GoldenDatasetCase[]): GoldenDatasetCase[] {
  if (cases.length === 0) throw new Error("黄金集至少需要 1 条有效 Case");
  if (cases.length > MAX_GOLDEN_DATASET_CASES) {
    throw new Error(`黄金集不能超过 ${MAX_GOLDEN_DATASET_CASES} 条 Case`);
  }

  const seenIds = new Set<string>();
  return cases.map((item, index) => {
    const row = index + 1;
    const caseId = requiredText(
      item.caseId,
      `第 ${row} 条 Case ID`,
      MAX_GOLDEN_CASE_ID_LENGTH
    );
    if (seenIds.has(caseId)) {
      throw new Error(`Case ID 重复：${caseId}`);
    }
    seenIds.add(caseId);
    return {
      caseId,
      prompt: requiredText(
        item.prompt,
        `第 ${row} 条输入`,
        MAX_GOLDEN_CASE_TEXT_LENGTH
      ),
      candidateOutput: requiredText(
        item.candidateOutput,
        `第 ${row} 条候选输出`,
        MAX_GOLDEN_CASE_TEXT_LENGTH
      ),
      expectedAnswer: optionalText(
        item.expectedAnswer,
        `第 ${row} 条标准答案`,
        MAX_GOLDEN_CASE_TEXT_LENGTH
      ),
      humanLabel: parseHumanLabel(item.humanLabel),
      humanScore: parseHumanScore(item.humanScore),
      reviewerNote: optionalText(
        item.reviewerNote,
        `第 ${row} 条复核说明`,
        MAX_GOLDEN_REVIEWER_NOTE_LENGTH
      ),
    };
  });
}

function buildContentFingerprint(cases: GoldenDatasetCase[]): string {
  return fingerprint(JSON.stringify(cases));
}

function buildIntegrityFingerprint(
  version: GoldenDatasetVersionIntegritySource
): string {
  return fingerprint(
    JSON.stringify({
      id: version.id,
      datasetId: version.datasetId,
      version: version.version,
      name: version.name,
      createTime: version.createTime,
      createdBy: version.createdBy,
      changeNote: version.changeNote,
      sourceFileName: version.sourceFileName,
      contentFingerprint: version.contentFingerprint,
    })
  );
}

export function createGoldenDatasetVersion(
  input: CreateGoldenDatasetVersionInput
): GoldenDatasetVersion {
  const name = requiredText(
    input.name,
    "黄金集名称",
    MAX_GOLDEN_DATASET_NAME_LENGTH
  );
  const createdBy = requiredText(
    input.createdBy,
    "标注负责人",
    MAX_GOLDEN_DATASET_AUTHOR_LENGTH
  );
  const sourceFileName = optionalText(
    input.sourceFileName,
    "来源文件名",
    240
  );
  const cases = parseCases(input.cases);
  const datasetId = input.datasetId ?? generateId();
  const family = input.existingVersions.filter(
    (version) =>
      version.datasetId === datasetId && isGoldenDatasetVersionIntact(version)
  );
  if (input.datasetId && family.length === 0) {
    throw new Error("要追加版本的黄金集不存在或已损坏");
  }
  const version =
    family.reduce((maximum, item) => Math.max(maximum, item.version), 0) + 1;
  const changeNote = optionalText(
    input.changeNote,
    "变更说明",
    MAX_GOLDEN_DATASET_CHANGE_NOTE_LENGTH
  );
  if (version > 1 && !changeNote) {
    throw new Error("追加黄金集版本时必须填写变更说明");
  }
  const id = input.id ?? generateId();
  if (input.existingVersions.some((item) => item.id === id)) {
    throw new Error("黄金集版本 id 已存在");
  }
  const contentFingerprint = buildContentFingerprint(cases);
  const snapshot = {
    id,
    datasetId,
    version,
    name,
    createTime: input.createTime ?? Date.now(),
    createdBy,
    changeNote,
    sourceFileName,
    cases,
    contentFingerprint,
  };
  return {
    ...snapshot,
    integrityFingerprint: buildIntegrityFingerprint(snapshot),
  };
}

export function isGoldenDatasetVersionIntact(
  version: GoldenDatasetVersion
): boolean {
  try {
    const cases = parseCases(version.cases);
    if (version.contentFingerprint !== buildContentFingerprint(cases)) {
      return false;
    }
    return (
      version.integrityFingerprint === buildIntegrityFingerprint(version)
    );
  } catch {
    return false;
  }
}

export function cloneGoldenDatasetCases(
  version: GoldenDatasetVersion
): GoldenDatasetCase[] {
  if (!isGoldenDatasetVersionIntact(version)) {
    throw new Error("黄金集版本完整性校验失败，不能加载");
  }
  return version.cases.map((item) => ({ ...item }));
}
