import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { ARCHIVE_PAGE_SIZE, archiveStatus, archiveType, type ArchiveSummary, type ArchivePage, type ArchiveContent, type ArchiveType, type ArchiveRow } from "../lib/localArchive";
import { redactSensitiveText } from "../lib/redactSensitive";

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_INDEX_BYTES = 256 * 1024 * 1024;
const MAX_SHARDS = 1000;
const SHARD_NAME = /^records-\d{4}\.js$/;

export class ArchiveError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 422) { super(message); }
}

function invalid(): never { throw new ArchiveError("INVALID_ARCHIVE", "归档格式不符合约定，请核对源文件。未修改任何数据。"); }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function digest(value: string | Buffer) { return createHash("sha256").update(value).digest("hex"); }

/** Reads a regular, non-linked file with an allocation ceiling, even if it grows during reading. */
export async function readArchiveFile(file: string, limit = MAX_FILE_BYTES): Promise<Buffer> {
  if (await realpath(file) !== path.resolve(file)) invalid();
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size > limit) throw new ArchiveError("ARCHIVE_LIMIT", "归档文件超过本地演示的读取上限。", 413);
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    const after = await handle.stat();
    if (length > limit) throw new ArchiveError("ARCHIVE_LIMIT", "归档文件超过本地演示的读取上限。", 413);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || length !== before.size) {
      throw new ArchiveError("ARCHIVE_CHANGED", "归档读取期间发生变化，请重启本地预览后重新核对。", 409);
    }
    return buffer.subarray(0, length);
  } finally { await handle.close(); }
}

interface Shard { file: string; count: number; bytes: number }
type RawRecord = Record<string, unknown> & { id: string; type: string };

export function parseArchiveShard(bytes: Buffer, name: string): RawRecord[] {
  if (!SHARD_NAME.test(name) || bytes.length > MAX_FILE_BYTES) invalid();
  const prefix = `window.PORTABLE_RECORD_SHARDS=window.PORTABLE_RECORD_SHARDS||{};window.PORTABLE_RECORD_SHARDS[${JSON.stringify(name)}]=`;
  const text = bytes.toString("utf8").trimEnd();
  if (!text.startsWith(prefix) || !text.endsWith(";")) invalid();
  let value: unknown;
  try { value = JSON.parse(text.slice(prefix.length, -1)); } catch { invalid(); }
  if (!Array.isArray(value) || value.length > 300 || !value.every((row) =>
    object(row) && typeof row.id === "string" && typeof row.type === "string")) invalid();
  return value as RawRecord[];
}

export class LocalArchiveReader {
  private summaryPromise?: Promise<ArchiveSummary>;
  private hashes = new Map<number, string>();
  private constructor(private root: string, private shards: Shard[], private manifestCount: number | null, private provenance: ArchiveSummary["provenance"]) {}

  static async create(root: string, provenance: ArchiveSummary["provenance"]): Promise<LocalArchiveReader> {
    const canonical = await realpath(root);
    const bytes = await readArchiveFile(path.join(canonical, "data", "manifest.json"));
    let manifest: unknown;
    try { manifest = JSON.parse(bytes.toString("utf8")); } catch { invalid(); }
    if (!object(manifest) || !Array.isArray(manifest.recordShards) || !manifest.recordShards.length || manifest.recordShards.length > MAX_SHARDS) invalid();
    const shards: Shard[] = manifest.recordShards.map((s) => {
      if (!object(s) || typeof s.file !== "string" || !SHARD_NAME.test(s.file) ||
        !Number.isSafeInteger(s.count) || Number(s.count) < 0 || Number(s.count) > 300 ||
        !Number.isSafeInteger(s.bytes) || Number(s.bytes) < 0 || Number(s.bytes) > MAX_FILE_BYTES) invalid();
      return { file: s.file, count: Number(s.count), bytes: Number(s.bytes) };
    });
    if (new Set(shards.map((s) => s.file)).size !== shards.length || shards.reduce((a, s) => a + s.bytes, 0) > MAX_INDEX_BYTES) invalid();
    const counts = object(manifest.recordCounts) ? Object.values(manifest.recordCounts) : [];
    const manifestCount = counts.length && counts.every((n) => Number.isSafeInteger(n) && Number(n) >= 0)
      ? counts.reduce<number>((sum, n) => sum + Number(n), 0) : null;
    return new LocalArchiveReader(canonical, shards, manifestCount !== null && Number.isSafeInteger(manifestCount) ? manifestCount : null, provenance);
  }

  private async readShard(index: number) {
    if (!Number.isSafeInteger(index) || !this.shards[index]) throw new ArchiveError("BAD_PAGE", "分片或记录位置无效。", 400);
    const descriptor = this.shards[index];
    const bytes = await readArchiveFile(path.join(this.root, "data", "records", descriptor.file));
    const rows = parseArchiveShard(bytes, descriptor.file);
    if (rows.length !== descriptor.count || bytes.length !== descriptor.bytes) invalid();
    const hash = digest(bytes);
    if (this.hashes.has(index) && this.hashes.get(index) !== hash) {
      throw new ArchiveError("ARCHIVE_CHANGED", "归档与本次核对快照不一致，请重启本地预览后重新核对。", 409);
    }
    return { rows, hash, bytes: bytes.length };
  }

  summary(): Promise<ArchiveSummary> {
    // Single flight, metadata only. A failed audit remains failed until the source is reopened.
    this.summaryPromise ??= this.audit();
    return this.summaryPromise;
  }

  private async audit(): Promise<ArchiveSummary> {
    const counts: ArchiveSummary["counts"] = { "跑批结果": 0, "Judge 结果": 0, "Judge 任务": 0, "失败记录": 0, "其他": 0 };
    const ids = new Set<string>();
    let totalRecords = 0, indexBytes = 0;
    for (let index = 0; index < this.shards.length; index++) {
      const shard = await this.readShard(index);
      this.hashes.set(index, shard.hash);
      indexBytes += shard.bytes;
      totalRecords += shard.rows.length;
      shard.rows.forEach((row) => { ids.add(row.id); counts[archiveType(row.type)]++; });
    }
    return { schemaVersion: 1, provenance: this.provenance, verifiedAt: new Date().toISOString(),
      totalRecords, uniqueRecordIds: ids.size, counts, indexBytes, shardCount: this.shards.length,
      manifestCountDelta: this.manifestCount === null ? null : this.manifestCount - totalRecords };
  }

  async page(shard: number, page: number, type?: ArchiveType): Promise<ArchivePage> {
    await this.summary();
    if (!Number.isSafeInteger(page) || page < 1) throw new ArchiveError("BAD_PAGE", "页码无效。", 400);
    const { rows } = await this.readShard(shard);
    const selected = rows.map((row, offset) => ({ row, offset })).filter(({ row }) => !type || archiveType(row.type) === type);
    if (page > Math.max(1, Math.ceil(selected.length / ARCHIVE_PAGE_SIZE))) throw new ArchiveError("BAD_PAGE", "页码超出当前分片范围。", 400);
    return { shard, page, pageSize: ARCHIVE_PAGE_SIZE, totalInShard: rows.length, matchingInShard: selected.length,
      rows: selected.slice((page - 1) * ARCHIVE_PAGE_SIZE, page * ARCHIVE_PAGE_SIZE).map(({ row, offset }): ArchiveRow => ({
        key: `${shard}:${offset}`, offset, type: archiveType(row.type),
        modelAlias: typeof row.model === "string" && row.model ? `模型 ${digest(row.model).slice(0, 8)}` : "模型未记录",
        status: archiveStatus(row.status),
        hasPrompt: typeof row.prompt === "string" && !!row.prompt.trim(), hasOutput: typeof row.output === "string" && !!row.output.trim(),
        hasEvidence: typeof row.evidenceHash === "string" && /^[a-f0-9]{64}$/.test(row.evidenceHash),
        imageCount: Array.isArray(row.images) ? row.images.length : 0,
      })) };
  }

  async content(shard: number, offset: number): Promise<ArchiveContent> {
    await this.summary();
    const { rows } = await this.readShard(shard);
    if (!Number.isSafeInteger(offset) || offset < 0 || !rows[offset]) throw new ArchiveError("BAD_PAGE", "记录位置无效。", 400);
    const row = rows[offset];
    let truncated = false;
    const text = (value: unknown) => {
      if (typeof value !== "string" || !value.trim()) return null;
      const redacted = redactSensitiveText(value);
      if (redacted.length > 6000) truncated = true;
      return redacted.slice(0, 6000);
    };
    const prompt = text(row.prompt), output = text(row.output), reason = text(row.reason);
    return { key: `${shard}:${offset}`, prompt, output, reason, truncated,
      evidence: typeof row.evidenceHash === "string" && /^[a-f0-9]{64}$/.test(row.evidenceHash)
        ? { hash: row.evidenceHash, line: Number.isSafeInteger(row.lineNo) && Number(row.lineNo) > 0 ? Number(row.lineNo) : null } : null };
  }
}
