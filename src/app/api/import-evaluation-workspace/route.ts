import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type ImportMode = "batch_only" | "comparison" | "reference";
type MissingPolicy = "skip" | "blank" | "stop";

interface ImportDatasetRow {
  input?: unknown;
  expected_output?: unknown;
  image_url?: unknown;
  metadata?: unknown;
}

interface ImportBody {
  project_name?: string;
  import_type?: string;
  dataset?: ImportDatasetRow[];
  evaluation?: {
    mode?: ImportMode;
    dimensions?: { name?: unknown; desc?: unknown }[];
    eval_prompt?: unknown;
  };
  missing_policy?: MissingPolicy;
  target_hint?: {
    content_mode?: "text" | "image";
    preferred_targets?: unknown;
  };
}

interface StoredImport {
  id: string;
  createTime: number;
  expiresAt: number;
  body: NormalizedImportBody;
  summary: ImportSummary;
  warnings: string[];
}

interface NormalizedImportBody {
  project_name: string;
  import_type: string;
  dataset: {
    input: string;
    expected_output: string;
    image_url: string;
    metadata: Record<string, unknown>;
  }[];
  evaluation: {
    mode: ImportMode;
    dimensions: { name: string; desc?: string }[];
    eval_prompt: string;
  };
  missing_policy: MissingPolicy;
  target_hint: {
    content_mode: "text" | "image";
    preferred_targets: string[];
  };
}

interface ImportSummary {
  total: number;
  imported: number;
  skipped: number;
  with_expected_output: number;
  missing_expected_output: number;
}

const MAX_ROWS = 5000;
const EXPIRE_MS = 1000 * 60 * 60;

function store(): Map<string, StoredImport> {
  const globalStore = globalThis as typeof globalThis & {
    __evalPlatformImports?: Map<string, StoredImport>;
  };
  if (!globalStore.__evalPlatformImports) {
    globalStore.__evalPlatformImports = new Map();
  }
  return globalStore.__evalPlatformImports;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value);
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeMode(value: unknown): ImportMode {
  if (value === "batch_only" || value === "comparison" || value === "reference") {
    return value;
  }
  return "reference";
}

function normalizeMissingPolicy(value: unknown): MissingPolicy {
  if (value === "skip" || value === "blank" || value === "stop") return value;
  return "stop";
}

function normalizeBody(body: ImportBody): {
  ok: true;
  value: NormalizedImportBody;
  summary: ImportSummary;
  warnings: string[];
} | {
  ok: false;
  error: string;
} {
  if (!Array.isArray(body.dataset)) {
    return { ok: false, error: "缺少 dataset 数组" };
  }
  if (body.dataset.length === 0) {
    return { ok: false, error: "dataset 不能为空" };
  }
  if (body.dataset.length > MAX_ROWS) {
    return { ok: false, error: `dataset 最多支持 ${MAX_ROWS} 行` };
  }

  const mode = normalizeMode(body.evaluation?.mode);
  const missingPolicy = normalizeMissingPolicy(body.missing_policy);
  const warnings: string[] = [];
  const normalizedRows = body.dataset.map((row) => ({
    input: toStringValue(row.input),
    expected_output: toStringValue(row.expected_output),
    image_url: toStringValue(row.image_url),
    metadata: normalizeMetadata(row.metadata),
  }));

  const missingInput = normalizedRows.filter((row) => !row.input).length;
  const missingExpected = normalizedRows.filter((row) => !row.expected_output).length;

  if (missingPolicy === "stop") {
    if (missingInput > 0) {
      return { ok: false, error: `有 ${missingInput} 行缺少 input，请确认后再导入` };
    }
    if (mode === "reference" && missingExpected > 0) {
      return {
        ok: false,
        error: `标准答案模式下有 ${missingExpected} 行缺少 expected_output，请确认后再导入`,
      };
    }
  }

  const dataset =
    missingPolicy === "skip"
      ? normalizedRows.filter(
          (row) => row.input && (mode !== "reference" || row.expected_output)
        )
      : normalizedRows;

  const dimensions = Array.isArray(body.evaluation?.dimensions)
    ? body.evaluation.dimensions
        .map((dimension) => ({
          name: toStringValue(dimension.name),
          desc: toStringValue(dimension.desc) || undefined,
        }))
        .filter((dimension) => dimension.name)
    : [];

  const preferredTargets = Array.isArray(body.target_hint?.preferred_targets)
    ? body.target_hint.preferred_targets.map(toStringValue).filter(Boolean)
    : [];

  if (missingInput > 0) warnings.push(`${missingInput} 行缺少 input`);
  if (missingExpected > 0) warnings.push(`${missingExpected} 行缺少 expected_output`);
  if (dataset.length < normalizedRows.length) {
    warnings.push(`已按 skip 策略跳过 ${normalizedRows.length - dataset.length} 行`);
  }

  const value: NormalizedImportBody = {
    project_name: toStringValue(body.project_name) || "导入评测项目",
    import_type: toStringValue(body.import_type) || "dataset_with_expected",
    dataset,
    evaluation: {
      mode,
      dimensions,
      eval_prompt: toStringValue(body.evaluation?.eval_prompt),
    },
    missing_policy: missingPolicy,
    target_hint: {
      content_mode: body.target_hint?.content_mode === "image" ? "image" : "text",
      preferred_targets: preferredTargets,
    },
  };

  return {
    ok: true,
    value,
    warnings,
    summary: {
      total: body.dataset.length,
      imported: dataset.length,
      skipped: body.dataset.length - dataset.length,
      with_expected_output: dataset.filter((row) => row.expected_output).length,
      missing_expected_output: dataset.filter((row) => !row.expected_output).length,
    },
  };
}

function cleanupExpired() {
  const now = Date.now();
  for (const [id, item] of Array.from(store().entries())) {
    if (item.expiresAt <= now) store().delete(id);
  }
}

function originFromRequest(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  let body: ImportBody;
  try {
    body = (await request.json()) as ImportBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求体解析失败，需为合法 JSON" },
      { status: 400 }
    );
  }

  const normalized = normalizeBody(body);
  if (!normalized.ok) {
    return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });
  }

  cleanupExpired();
  const id = generateId();
  const now = Date.now();
  const stored: StoredImport = {
    id,
    createTime: now,
    expiresAt: now + EXPIRE_MS,
    body: normalized.value,
    summary: normalized.summary,
    warnings: normalized.warnings,
  };
  store().set(id, stored);

  const mode = normalized.value.evaluation.mode;
  const contentMode = normalized.value.target_hint.content_mode;
  const openUrl = `${originFromRequest(request)}/?tab=run&import_id=${encodeURIComponent(
    id
  )}&mode=${encodeURIComponent(mode)}&content_mode=${encodeURIComponent(contentMode)}`;

  return NextResponse.json({
    ok: true,
    project_id: null,
    draft_id: id,
    open_url: openUrl,
    summary: normalized.summary,
    warnings: normalized.warnings,
    expires_at: stored.expiresAt,
  });
}

export async function GET(request: Request) {
  cleanupExpired();
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const stored = store().get(id);
  if (!stored) {
    return NextResponse.json(
      { ok: false, error: "导入包不存在或已过期，请重新提交" },
      { status: 404 }
    );
  }
  return NextResponse.json({
    ok: true,
    id: stored.id,
    createTime: stored.createTime,
    body: stored.body,
    summary: stored.summary,
    warnings: stored.warnings,
  });
}
