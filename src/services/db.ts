import Dexie, { type Table } from "dexie";
import type { Project } from "@/types";
import { SCHEMA_VERSION } from "@/types";

/**
 * 本地 IndexedDB 持久化层。
 * 仅一张 projects 表，主键为 Project.id。
 */
class EvalPlatformDb extends Dexie {
  projects!: Table<Project, string>;

  constructor() {
    super("eval-platform");
    this.version(1).stores({
      projects: "id, updateTime",
    });
  }
}

export const db = new EvalPlatformDb();

export async function saveProject(project: Project): Promise<void> {
  await db.projects.put(project);
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function listProjects(): Promise<Project[]> {
  return db.projects.orderBy("updateTime").reverse().toArray();
}

/**
 * 判断一条持久化记录是否为当前 schema 版本且结构完整。
 * 旧版（缺 targetConfigs / 版本不匹配）的项目会被判定为不兼容，
 * 上层据此弃用并重建，避免用 undefined 字段渲染导致崩溃。
 */
export function isCompatibleProject(value: unknown): value is Project {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === SCHEMA_VERSION &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.targetConfigs) &&
    Array.isArray(candidate.tasks)
  );
}

/**
 * 返回兼容当前 schema 的项目；同时清理掉数据库中不兼容的旧记录。
 */
export async function listCompatibleProjects(): Promise<Project[]> {
  const all = await db.projects.orderBy("updateTime").reverse().toArray();
  const compatible: Project[] = [];
  const staleIds: string[] = [];
  for (const item of all) {
    if (isCompatibleProject(item)) {
      compatible.push(item);
    } else if (item && typeof (item as { id?: unknown }).id === "string") {
      staleIds.push((item as { id: string }).id);
    }
  }
  if (staleIds.length > 0) {
    await db.projects.bulkDelete(staleIds);
  }
  return compatible;
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
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
