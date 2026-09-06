import path from "node:path";
import { ARCHIVE_TYPES, type ArchiveType } from "../lib/localArchive";
import { ArchiveError, LocalArchiveReader, readArchiveFile } from "./localArchiveReader";
import { isLocalRequest } from "./localRequest";

export function assertLocalArchiveRequest(request: Request): void {
  if (!isLocalRequest(request, "x-eval-archive", "local-read")) {
    throw new ArchiveError("LOCAL_ONLY", "仅允许从本机工作台读取归档。", 403);
  }
}

let cached: { config: string; reader: Promise<LocalArchiveReader> } | undefined;
export async function configuredArchive(): Promise<LocalArchiveReader> {
  const file = path.resolve(process.env.EVAL_ARCHIVE_CONFIG || "local-data/archive-source.json");
  let config: string;
  try { config = (await readArchiveFile(file, 4096)).toString("utf8"); }
  catch { throw new ArchiveError("NOT_CONFIGURED", "尚未配置本地历史归档。请按项目说明连接本机目录，不需要模型密钥。", 503); }
  if (cached?.config === config) return cached.reader;
  let parsed: unknown;
  try { parsed = JSON.parse(config); } catch { throw new ArchiveError("BAD_CONFIG", "本机归档配置无效。", 503); }
  if (!parsed || typeof parsed !== "object" || !("root" in parsed) || typeof parsed.root !== "string" ||
    !("provenance" in parsed) || !["historical-unverified", "synthetic"].includes(String(parsed.provenance))) {
    throw new ArchiveError("BAD_CONFIG", "本机归档配置无效。", 503);
  }
  cached = { config, reader: LocalArchiveReader.create(path.resolve(parsed.root), parsed.provenance as "historical-unverified" | "synthetic") };
  return cached.reader;
}

export async function readArchiveRequest(request: Request) {
  assertLocalArchiveRequest(request);
  const params = new URL(request.url).searchParams;
  if (Array.from(params.keys()).some((key) => !["action", "shard", "page", "type", "offset"].includes(key)) ||
    Array.from(params.keys()).some((key) => params.getAll(key).length > 1)) throw new ArchiveError("BAD_QUERY", "不支持的查询参数。", 400);
  const action = params.get("action") ?? "summary";
  if (!["summary", "page", "content"].includes(action)) throw new ArchiveError("BAD_QUERY", "不支持的读取操作。", 400);
  const integer = (name: string, fallback: string) => {
    const raw = params.get(name) ?? fallback;
    if (!/^\d{1,6}$/.test(raw)) throw new ArchiveError("BAD_QUERY", "分片、页码或位置必须为非负整数。", 400);
    return Number(raw);
  };
  const shard = integer("shard", "0"), page = integer("page", "1"), offset = integer("offset", "0");
  const type = params.get("type") ?? undefined;
  if (type && !ARCHIVE_TYPES.includes(type as ArchiveType)) throw new ArchiveError("BAD_QUERY", "不支持的记录类别。", 400);
  if (action === "content" && request.headers.get("x-eval-confirm-content") !== "1") throw new ArchiveError("CONTENT_CONFIRMATION", "查看正文前请确认本机隐私提示。", 403);
  const reader = await configuredArchive();
  if (action === "summary") return reader.summary();
  if (action === "content") return reader.content(shard, offset);
  return reader.page(shard, page, type as ArchiveType | undefined);
}
