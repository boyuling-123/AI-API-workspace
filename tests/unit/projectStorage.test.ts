import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION, type Project } from "@/types";
import {
  db, deleteProject, getProject, isCompatibleProject, listCompatibleProjects,
  projectSaveErrorMessage, ProtectedProjectError, readProjectCatalog, saveProject,
} from "@/services/db";

function project(id = "current", updateTime = 20): Project {
  return { id, version: SCHEMA_VERSION, name: "合成项目", createTime: 1,
    updateTime, targetConfigs: [], tasks: [], evaluations: [] };
}

const legacy = {
  id: "legacy", version: SCHEMA_VERSION - 1, name: "合成旧项目", updateTime: 900,
  unknownField: { untouched: [null, 0, "历史内容"] },
};

async function seed(records: unknown[]) {
  await db.projects.bulkPut(records as Project[]);
}

beforeEach(async () => { await db.projects.clear(); });
afterEach(async () => { vi.restoreAllMocks(); await db.projects.clear(); });

describe("non-destructive project storage (real Dexie on memory IndexedDB)", () => {
  it("only checks required top-level fields and permits absent optional history", () => {
    expect(isCompatibleProject(project())).toBe(true);
    for (const field of ["id", "name", "createTime", "updateTime", "targetConfigs", "tasks", "evaluations"]) {
      expect(isCompatibleProject({ ...project(), [field]: undefined })).toBe(false);
    }
    for (const value of [null, [], legacy, { ...project(), updateTime: NaN }, { ...project(), createTime: Infinity }]) {
      expect(isCompatibleProject(value)).toBe(false);
    }
  });

  it("counts unindexed records and never writes while reading the catalog", async () => {
    await seed([project(), legacy, { id: "missing-time", raw: [1, null] }]);
    const before = await db.projects.toArray();
    const put = vi.spyOn(db.projects, "put");
    const remove = vi.spyOn(db.projects, "delete");
    const bulkRemove = vi.spyOn(db.projects, "bulkDelete");
    expect(await readProjectCatalog()).toEqual({ projects: [project()], retainedIncompatibleCount: 2 });
    expect(await listCompatibleProjects()).toEqual([project()]);
    expect(await db.projects.toArray()).toEqual(before);
    expect(put).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(bulkRemove).not.toHaveBeenCalled();
  });

  it("preserves latest-first ordering and reverse ID ordering for ties", async () => {
    await seed([project("old", 1), project("a"), project("z"), project("new", 30)]);
    expect((await readProjectCatalog()).projects.map(({ id }) => id)).toEqual(["new", "z", "a", "old"]);
  });

  it("returns an empty compatible catalog without clearing all-legacy records", async () => {
    await seed([legacy, { id: "no-index" }]);
    const before = await db.projects.toArray();
    expect(await readProjectCatalog()).toEqual({ projects: [], retainedIncompatibleCount: 2 });
    expect(await db.projects.toArray()).toEqual(before);
  });

  it("inserts and updates a current project while retaining unknown fields elsewhere", async () => {
    await seed([legacy]);
    await saveProject(project());
    const edited = { ...project(), name: "已编辑", updateTime: 40 };
    await saveProject(edited);
    expect(await getProject("current")).toEqual(edited);
    expect(await getProject("legacy")).toEqual(legacy);
    expect(await db.projects.count()).toBe(2);
  });

  it("rejects an incompatible ID collision atomically, including simultaneous saves", async () => {
    await seed([legacy]);
    const results = await Promise.allSettled([saveProject(project("legacy")), saveProject(project("legacy", 50))]);
    expect(results.every((result) => result.status === "rejected" && result.reason instanceof ProtectedProjectError)).toBe(true);
    expect(await db.projects.toArray()).toEqual([legacy]);
  });

  it("does not allow an invalid incoming project to overwrite a valid one", async () => {
    await saveProject(project());
    await expect(saveProject({ ...project(), version: -1 })).rejects.toThrow("incompatible project");
    expect(await getProject("current")).toEqual(project());
  });

  it("keeps explicit deletion scoped to its requested ID", async () => {
    await seed([legacy, project()]);
    await deleteProject("current");
    expect(await db.projects.toArray()).toEqual([legacy]);
  });

  it("maps errors to actionable fixed text without leaking exception content", () => {
    const quota = new Error("PRIVATE_TEST_DETAIL");
    quota.name = "QuotaExceededError";
    expect(projectSaveErrorMessage(quota)).toContain("存储空间不足");
    expect(projectSaveErrorMessage(new ProtectedProjectError())).toContain("旧数据未被覆盖");
    for (const error of [quota, new Error("PRIVATE_TEST_DETAIL"), { message: "PRIVATE_TEST_DETAIL" }, null]) {
      expect(projectSaveErrorMessage(error)).not.toContain("PRIVATE_TEST_DETAIL");
      expect(projectSaveErrorMessage(error)).toContain("导出");
    }
  });
});
