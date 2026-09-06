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

export class ProtectedProjectError extends Error {
  constructor() {
    super("Cannot overwrite an incompatible stored project");
    this.name = "ProtectedProjectError";
  }
}

export async function saveProject(project: Project): Promise<void> {
  if (!isCompatibleProject(project)) {
    throw new Error("Cannot save an incompatible project");
  }
  // Check and write atomically, including imports that reuse a legacy ID.
  await db.transaction("rw", db.projects, async () => {
    const existing = await db.projects.get(project.id);
    if (existing !== undefined && !isCompatibleProject(existing)) {
      throw new ProtectedProjectError();
    }
    await db.projects.put(project);
  });
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function listProjects(): Promise<Project[]> {
  return db.projects.orderBy("updateTime").reverse().toArray();
}

/**
 * 检查当前版本的顶层必需字段，不执行迁移或嵌套业务验证。
 * 不兼容记录仅不加载，必须留在原表中。
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
    typeof candidate.createTime === "number" &&
    Number.isFinite(candidate.createTime) &&
    typeof candidate.updateTime === "number" &&
    Number.isFinite(candidate.updateTime) &&
    Array.isArray(candidate.targetConfigs) &&
    Array.isArray(candidate.tasks) &&
    Array.isArray(candidate.evaluations)
  );
}

export interface ProjectCatalog {
  projects: Project[];
  retainedIncompatibleCount: number;
}

export async function readProjectCatalog(): Promise<ProjectCatalog> {
  // An index scan would omit records without an indexed updateTime.
  const all = await db.projects.toArray();
  const projects: Project[] = [];
  let retainedIncompatibleCount = 0;
  for (const item of all) {
    if (isCompatibleProject(item)) {
      projects.push(item);
    } else {
      retainedIncompatibleCount += 1;
    }
  }
  projects.sort((a, b) => b.updateTime - a.updateTime ||
    (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  return { projects, retainedIncompatibleCount };
}

export async function listCompatibleProjects(): Promise<Project[]> {
  return (await readProjectCatalog()).projects;
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

export function projectSaveErrorMessage(error: unknown): string {
  if (error instanceof ProtectedProjectError) {
    return "未保存：此项目 ID 与保留的旧项目冲突，旧数据未被覆盖。请先导出当前项目，再新建项目处理。";
  }
  if (isQuotaExceededError(error)) {
    return "存储空间不足，当前更改尚未保存，请先导出当前项目备份；不要清理浏览器数据。";
  }
  return "本地保存失败，当前更改尚未保存，请先导出当前项目备份后重试。";
}
