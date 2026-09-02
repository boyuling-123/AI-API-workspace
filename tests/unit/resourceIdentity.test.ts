import { describe, expect, it } from "vitest";
import {
  buildTargetInvocationFingerprint,
  inspectResourceIdentityIssues,
  normalizeResourceAliases,
  parseResourceAliasText,
  validateResourceIdentity,
} from "../../src/lib/resourceIdentity";
import type { TargetConfig } from "../../src/types";

function target(patch: Partial<TargetConfig> = {}): TargetConfig {
  return {
    id: "target-a",
    name: "目标 A",
    type: "custom",
    contentKind: "text",
    resourceKind: "model",
    capabilityTags: ["text_understanding"],
    source: "manual",
    inputParams: [{ name: "prompt", type: "string", required: true }],
    requestTemplate: {
      url: "https://example.test/run",
      method: "POST",
      headers: [],
      bodyTemplate: '{"prompt":"{{prompt}}"}',
      stream: false,
      outputTextPath: "data.text",
    },
    apiKeyRef: "TARGET_API_KEY",
    status: "tested_ok",
    ...patch,
  };
}

describe("resourceIdentity", () => {
  it("parses comma variants and normalizes aliases as stable lowercase slugs", () => {
    const parsed = parseResourceAliasText(
      " Default-Judge，qwen-mm\nDEFAULT-JUDGE, image/main "
    );

    expect(parsed).toEqual([
      "Default-Judge",
      "qwen-mm",
      "DEFAULT-JUDGE",
      "image/main",
    ]);
    expect(normalizeResourceAliases(parsed)).toEqual([
      "default-judge",
      "qwen-mm",
      "image/main",
    ]);
  });

  it("accepts a bounded version and unique aliases", () => {
    expect(
      validateResourceIdentity({
        targetId: "target-a",
        version: " 2026-09 ",
        aliases: ["Judge.Main", "judge-backup"],
      })
    ).toEqual({
      ok: true,
      version: "2026-09",
      aliases: ["judge.main", "judge-backup"],
      issues: [],
    });
  });

  it("rejects duplicate, malformed, self-referencing, and excessive aliases", () => {
    const aliases = [
      "target-a",
      "UPPER SPACE",
      "same",
      "SAME",
      ...Array.from({ length: 9 }, (_, index) => `alias-${index}`),
    ];
    const result = validateResourceIdentity({
      targetId: "target-a",
      version: `v${"x".repeat(64)}`,
      aliases,
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("资源版本最多"),
        expect.stringContaining("资源别名最多 12 个"),
        "资源别名不能重复",
        expect.stringContaining("格式无效"),
        "别名 target-a 与当前资源 ID 重复",
      ])
    );
  });

  it("prevents aliases and imported IDs from colliding with another resource", () => {
    const existing = target({
      id: "target-b",
      name: "目标 B",
      resourceAliases: ["existing-alias"],
    });
    const aliasConflict = validateResourceIdentity({
      targetId: "target-a",
      aliases: ["target-b", "EXISTING-ALIAS"],
      existingConfigs: [existing],
    });
    const idConflict = validateResourceIdentity({
      targetId: "existing-alias",
      existingConfigs: [existing],
    });

    expect(aliasConflict.issues).toEqual(
      expect.arrayContaining([
        "别名 target-b 已被资源 目标 B 使用",
        "别名 existing-alias 已被资源 目标 B 使用",
      ])
    );
    expect(idConflict.issues).toContain(
      "资源 ID existing-alias 已被资源 目标 B 使用"
    );
  });

  it("keeps connectivity status valid for metadata edits but not invocation edits", () => {
    const original = target();
    const metadataEdit = target({
      name: "新名称",
      resourceVersion: "2.0.0",
      resourceAliases: ["new-alias"],
      source: "agent",
      status: "tested_fail",
      statusUpdatedAt: 1_700_000_000_000,
    });
    const invocationEdit = target({
      requestTemplate: {
        ...original.requestTemplate!,
        url: "https://example.test/v2/run",
      },
    });
    const explicitUndefined = target({
      requestTemplate: {
        ...original.requestTemplate!,
        preprocess: undefined,
      },
    });

    expect(buildTargetInvocationFingerprint(metadataEdit)).toBe(
      buildTargetInvocationFingerprint(original)
    );
    expect(buildTargetInvocationFingerprint(explicitUndefined)).toBe(
      buildTargetInvocationFingerprint(original)
    );
    expect(buildTargetInvocationFingerprint(invocationEdit)).not.toBe(
      buildTargetInvocationFingerprint(original)
    );
  });

  it("reports dirty imported metadata without mutating either resource", () => {
    const imported = target({ resourceAliases: ["target-b", "Bad Alias"] });
    const other = target({ id: "target-b", name: "目标 B" });
    const before = JSON.stringify([imported, other]);

    expect(inspectResourceIdentityIssues(imported, [imported, other])).toEqual(
      expect.arrayContaining([
        "别名 target-b 已被资源 目标 B 使用",
        expect.stringContaining("Bad Alias".toLocaleLowerCase("en-US")),
      ])
    );
    expect(JSON.stringify([imported, other])).toBe(before);
  });
});
