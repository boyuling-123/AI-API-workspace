import { SCHEMA_VERSION, type Project } from "@/types";

export class ProtectedProjectError extends Error {
  constructor() {
    super("Cannot overwrite an incompatible stored project");
    this.name = "ProtectedProjectError";
  }
}

/** 顶层兼容检查，不执行迁移、删除或嵌套业务验证。 */
export function isCompatibleProject(value: unknown): value is Project {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === SCHEMA_VERSION &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.createTime === "number" &&
    Number.isFinite(candidate.createTime) &&
    typeof candidate.updateTime === "number" &&
    Number.isFinite(candidate.updateTime) &&
    Array.isArray(candidate.targetConfigs) &&
    Array.isArray(candidate.tasks) &&
    Array.isArray(candidate.evaluations)
  );
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const name = error.name;
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    /quota/i.test(error.message)
  );
}

export function projectSaveErrorMessage(error: unknown): string {
  if (error instanceof ProtectedProjectError) {
    return "未保存：此项目 ID 与保留的旧项目冲突，旧数据未被覆盖。请先导出当前项目，再新建项目处理。";
  }
  if (isQuotaExceededError(error)) {
    return "存储空间不足，当前更改尚未保存，请先导出当前项目备份；不要清理浏览器数据。";
  }
  return "本地保存失败，当前更改尚未保存，请先导出当前项目备份后重试。";
}
