export const ARCHIVE_TYPES = ["跑批结果", "Judge 结果", "Judge 任务", "失败记录", "其他"] as const;
export type ArchiveType = typeof ARCHIVE_TYPES[number];
export const ARCHIVE_PAGE_SIZE = 50;

const STATUS_LABELS = {
  ok: "历史成功", success: "历史成功", passed: "历史成功", done: "历史成功",
  error: "历史失败", failed: "历史失败", failure: "历史失败",
  empty_result: "历史空结果", download_error: "历史下载失败", timeout: "历史超时",
  rate_limit: "历史限流", auth_error: "历史鉴权失败", safety_reject: "历史安全拒绝",
  invalid_output: "历史输出无效", pending: "历史待处理", not_eligible: "历史不符合条件", blocked: "历史受阻",
} as const;
export function archiveStatus(value: unknown): typeof STATUS_LABELS[keyof typeof STATUS_LABELS] | "未分类状态" {
  return typeof value === "string" && Object.hasOwn(STATUS_LABELS, value)
    ? STATUS_LABELS[value as keyof typeof STATUS_LABELS] : "未分类状态";
}

export interface ArchiveSummary {
  schemaVersion: 1;
  provenance: "historical-unverified" | "synthetic";
  verifiedAt: string;
  totalRecords: number;
  uniqueRecordIds: number;
  counts: Record<ArchiveType, number>;
  shardCount: number;
  manifestCountDelta: number | null;
  indexBytes: number;
}

export interface ArchiveRow {
  key: string;
  offset: number;
  type: ArchiveType;
  modelAlias: string;
  status: ReturnType<typeof archiveStatus>;
  hasPrompt: boolean;
  hasOutput: boolean;
  hasEvidence: boolean;
  imageCount: number;
}

export interface ArchivePage {
  shard: number;
  page: number;
  pageSize: 50;
  totalInShard: number;
  matchingInShard: number;
  rows: ArchiveRow[];
}

export interface ArchiveContent {
  key: string;
  prompt: string | null;
  output: string | null;
  reason: string | null;
  truncated: boolean;
  evidence: { hash: string; line: number | null } | null;
}

export function archiveType(value: unknown): ArchiveType {
  return ARCHIVE_TYPES.includes(value as ArchiveType) ? value as ArchiveType : "其他";
}
