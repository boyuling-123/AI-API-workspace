import Dexie, { type Table } from "dexie";
import type { Project } from "@/types";
import type { ProjectCatalog } from "@/lib/projectRepository";
import { isCompatibleProject, ProtectedProjectError } from "@/lib/projectStoragePolicy";

// Preserve existing callers while keeping policy independent of the driver.
export { isCompatibleProject, isQuotaExceededError, projectSaveErrorMessage, ProtectedProjectError } from "@/lib/projectStoragePolicy";
export type { ProjectCatalog } from "@/lib/projectRepository";

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
