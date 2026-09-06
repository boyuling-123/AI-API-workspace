import * as z from "zod/v4";
import { ARCHIVE_TYPES, type ArchiveSummary } from "../lib/localArchive";
import { ACTION_ERRORS, ACTION_LIMITS, PLATFORM_ACTION_NAMES, PLATFORM_ACTIONS, type ActionErrorCode, type PlatformActionResult } from "../lib/platformActions";
import { configuredArchive } from "./localArchiveAccess";
import { ArchiveError } from "./localArchiveReader";

export const emptyActionInput = z.strictObject({}, { error: () => ACTION_ERRORS.INVALID_ACTION });
const requestSchema = z.strictObject({ name: z.enum(PLATFORM_ACTION_NAMES), arguments: emptyActionInput });

export class PlatformActionError extends Error {
  constructor(public readonly code: ActionErrorCode, public readonly status: number) { super(ACTION_ERRORS[code]); }
}

export function safeActionError(error: unknown): PlatformActionError {
  if (error instanceof PlatformActionError) return new PlatformActionError(error.code, error.status);
  if (error instanceof ArchiveError && error.code === "LOCAL_ONLY") return new PlatformActionError("LOCAL_ONLY", 403);
  if (error instanceof ArchiveError && error.code === "NOT_CONFIGURED") return new PlatformActionError("NOT_CONFIGURED", 503);
  return new PlatformActionError("ARCHIVE_UNAVAILABLE", 503);
}

export interface PlatformActionServices { archiveSummary(): Promise<ArchiveSummary> }
const services: PlatformActionServices = { archiveSummary: async () => (await configuredArchive()).summary() };

export async function executePlatformAction(input: unknown, dependencies: PlatformActionServices = services): Promise<PlatformActionResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) throw new PlatformActionError("INVALID_ACTION", 400);
  if (parsed.data.name === "get_platform_capabilities") {
    return { action: parsed.data.name, schemaVersion: 1, tools: PLATFORM_ACTIONS, limits: ACTION_LIMITS, transport: "stdio", modelCalls: 0 };
  }
  try {
    const source = await dependencies.archiveSummary();
    // Explicit projection keeps future reader fields out of the Assistant's data boundary.
    const counts = Object.fromEntries(ARCHIVE_TYPES.map((type) => [type, source.counts[type]])) as ArchiveSummary["counts"];
    const summary: ArchiveSummary = { schemaVersion: 1, provenance: source.provenance, verifiedAt: source.verifiedAt,
      totalRecords: source.totalRecords, uniqueRecordIds: source.uniqueRecordIds, counts, shardCount: source.shardCount,
      manifestCountDelta: source.manifestCountDelta, indexBytes: source.indexBytes };
    return { action: parsed.data.name, schemaVersion: 1, summary, scope: "local-read-only-archive", modelCalls: 0,
      definitions: {
        totalRecords: "索引记录数，不是独立测试用例数或模型调用次数；Judge 任务与结果不能相加为评测次数。",
        uniqueRecordIds: "原始 ID 去重数，不等于业务用例去重数。",
        provenance: "historical-unverified 是未认证历史来源；synthetic 是合成夹具，均不证明模型质量。",
      } };
  } catch (error) { throw safeActionError(error); }
}
