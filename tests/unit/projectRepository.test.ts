import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION, type Project } from "@/types";
import { ProtectedProjectError, projectSaveErrorMessage } from "@/lib/projectStoragePolicy";
import { db } from "@/services/db";
import { indexedDbProjectRepository } from "@/services/indexedDbProjectRepository";
import { projectRepository } from "@/services/projectRepository";

function project(id = "current", updateTime = 20): Project {
  return { id, version: SCHEMA_VERSION, name: "合成契约项目", createTime: 1,
    updateTime, targetConfigs: [], tasks: [], evaluations: [] };
}
const legacy = { id: "legacy", version: -1, raw: { zero: 0, empty: null } };

beforeEach(async () => { await db.projects.clear(); });
afterEach(async () => { vi.restoreAllMocks(); await db.projects.clear(); });

describe("default ProjectRepository contract on real Dexie", () => {
  it("binds the only real adapter and exposes honest immutable capabilities", () => {
    expect(projectRepository).toBe(indexedDbProjectRepository);
    expect(Object.isFrozen(projectRepository)).toBe(true);
    expect(Object.isFrozen(projectRepository.capabilities)).toBe(true);
    expect(projectRepository.capabilities).toEqual({
      driver: "indexeddb", scope: "browser-origin", entity: "project",
      crossDeviceSync: false, automaticMigration: false, streaming: false,
    });
    expect(db.name).toBe("eval-platform");
    expect(db.verno).toBe(1);
    expect(db.tables.map(({ name }) => name)).toEqual(["projects"]);
    expect(db.projects.schema.primKey.keyPath).toBe("id");
    expect(db.projects.schema.indexes.map(({ name }) => name)).toEqual(["updateTime"]);
  });

  it("preserves legacy records while exposing only compatible reads and sorted catalog", async () => {
    await db.projects.put(legacy as unknown as Project);
    await projectRepository.save(project("a"));
    await projectRepository.save(project("z"));
    await projectRepository.save(project("new", 30));
    const before = await db.projects.toArray();
    expect(await projectRepository.getCompatible("legacy")).toBeUndefined();
    expect(await projectRepository.getCompatible("missing")).toBeUndefined();
    expect(await projectRepository.getCompatible("a")).toEqual(project("a"));
    const catalog = await projectRepository.readCatalog();
    expect(catalog.projects.map(({ id }) => id)).toEqual(["new", "z", "a"]);
    expect(catalog.retainedIncompatibleCount).toBe(1);
    expect(await db.projects.toArray()).toEqual(before);
  });

  it("keeps input and returned snapshots detached from persisted state", async () => {
    const input = project();
    const original = structuredClone(input);
    await projectRepository.save(input);
    expect(input).toEqual(original);
    input.name = "未保存输入更改";
    const saved = await projectRepository.getCompatible(input.id);
    expect(saved).toEqual(original);
    saved!.name = "未保存读取更改";
    const catalog = await projectRepository.readCatalog();
    catalog.projects[0].name = "未保存目录更改";
    expect(await projectRepository.getCompatible(input.id)).toEqual(original);
    await projectRepository.save({ ...original, name: "显式更新", updateTime: 21 });
    expect((await projectRepository.getCompatible(input.id))?.name).toBe("显式更新");
  });

  it("rejects invalid saves and protected ID collisions through the contract", async () => {
    await db.projects.put(legacy as unknown as Project);
    await expect(projectRepository.save(project("legacy"))).rejects.toBeInstanceOf(ProtectedProjectError);
    await expect(projectRepository.save({ ...project(), version: -1 })).rejects.toThrow("incompatible");
    expect(await db.projects.toArray()).toEqual([legacy]);
  });

  it("does not convert storage rejection into success or change other rows", async () => {
    await projectRepository.save(project());
    const failure = new Error("PRIVATE_TEST_DETAIL");
    failure.name = "QuotaExceededError";
    vi.spyOn(db.projects, "put").mockRejectedValueOnce(failure);
    const reported = await projectRepository.save({ ...project(), name: "保存失败" })
      .then(() => null, (error: unknown) => error);
    expect(reported).toBeInstanceOf(Error);
    expect(reported).toMatchObject({ name: "QuotaExceededError" });
    expect(await projectRepository.getCompatible("current")).toEqual(project());
    expect(projectSaveErrorMessage(reported)).toContain("尚未保存");
    expect(projectSaveErrorMessage(reported)).not.toContain("PRIVATE_TEST_DETAIL");
  });

  it("only removes the explicitly selected ID; deleting a missing ID is harmless", async () => {
    await db.projects.put(legacy as unknown as Project);
    await projectRepository.save(project());
    await projectRepository.deleteExplicit("missing");
    expect(await db.projects.count()).toBe(2);
    await projectRepository.deleteExplicit("legacy");
    expect(await db.projects.toArray()).toEqual([project()]);
  });
});

function source(path: string) {
  const filename = fileURLToPath(new URL(`../../src/${path}`, import.meta.url));
  return ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
}

function imports(file: ts.SourceFile) {
  return file.statements.filter(ts.isImportDeclaration)
    .map((item) => (item.moduleSpecifier as ts.StringLiteral).text);
}

describe("real project persistence dependency boundaries", () => {
  it("keeps the contract and shared policy free of driver or platform dependencies", () => {
    expect(imports(source("lib/projectRepository.ts"))).toEqual(["@/types"]);
    expect(imports(source("lib/projectStoragePolicy.ts"))).toEqual(["@/types"]);
    expect(imports(source("services/projectRepository.ts"))).toEqual([
      "@/lib/projectRepository", "@/services/indexedDbProjectRepository",
    ]);
  });

  it("wires actual Hook reads and saves through the composition root, not db or Dexie", () => {
    const hook = source("hooks/useProject.ts");
    expect(imports(hook)).toContain("@/services/projectRepository");
    expect(imports(hook)).not.toContain("@/services/db");
    expect(imports(hook)).not.toContain("@/services/indexedDbProjectRepository");
    expect(imports(hook)).not.toContain("dexie");
    const calls: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "projectRepository") {
        calls.push(node.expression.name.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(hook);
    expect(calls).toEqual(["readCatalog", "save", "save"]);
  });
});
