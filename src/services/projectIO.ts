import type { Project } from "@/types";
import { SCHEMA_VERSION } from "@/types";
import { formatTimestamp } from "@/lib/datetime";

export interface ImportResult {
  ok: boolean;
  project?: Project;
  error?: string;
}

/**
 * 导出当前项目为 JSON 文件：项目名_YYYYMMDD_HHmm.json。
 */
export function exportProjectToJson(project: Project): void {
  const content = JSON.stringify(project, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const fileName = `${sanitizeFileName(project.name)}_${formatTimestamp()}.json`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * 解析导入的 JSON 文本，做 version 校验。
 * 不兼容时明确返回错误，不强行导入。
 */
export function parseImportedProject(jsonText: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "文件不是合法的 JSON，无法导入" };
  }

  if (!isProjectShape(parsed)) {
    return { ok: false, error: "文件结构不符合项目格式，无法导入" };
  }

  if (parsed.version !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `版本不兼容：文件版本 ${parsed.version}，当前支持版本 ${SCHEMA_VERSION}，已停止导入以避免数据损坏`,
    };
  }

  return { ok: true, project: parsed };
}

function isProjectShape(value: unknown): value is Project {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.version === "number" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.targetConfigs) &&
    Array.isArray(candidate.tasks)
  );
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim() || "未命名项目";
  return trimmed.replace(/[\\/:*?"<>|]/g, "_");
}
