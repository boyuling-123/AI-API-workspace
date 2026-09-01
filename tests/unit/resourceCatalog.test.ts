import { describe, expect, it } from "vitest";
import { getDefaultTargets } from "../../src/config/builtinAlgos";
import {
  buildResourceCatalog,
  filterResourceCatalog,
  formatParameterDefault,
  formatParameterRange,
  inferResourceCapabilities,
  inferResourceKind,
} from "../../src/lib/resourceCatalog";
import type { TargetConfig } from "../../src/types";

function legacyTarget(
  patch: Partial<TargetConfig> = {}
): TargetConfig {
  return {
    id: "legacy-target",
    name: "旧文本目标",
    type: "custom",
    contentKind: "text",
    source: "manual",
    inputParams: [
      { name: "prompt", type: "string", required: true },
      { name: "temperature", type: "number", required: false },
    ],
    requestTemplate: {
      url: "https://example.test/run",
      method: "POST",
      headers: [],
      bodyTemplate: "{}",
      stream: false,
    },
    status: "tested_ok",
    ...patch,
  };
}

describe("resourceCatalog", () => {
  it("projects built-in models, algorithms, Judge roles, modalities, and ranges", () => {
    const catalog = buildResourceCatalog(getDefaultTargets());

    expect(catalog).toHaveLength(4);
    expect(catalog.filter((entry) => entry.kind === "model")).toHaveLength(3);
    expect(catalog.filter((entry) => entry.kind === "algorithm")).toHaveLength(
      1
    );
    expect(
      catalog.filter((entry) => entry.roles.includes("judge"))
    ).toHaveLength(3);

    expect(catalog.find((entry) => entry.id === "kimi-k2.6")).toMatchObject({
      capabilities: ["text_understanding", "image_understanding"],
      inputModalities: ["text", "image"],
      outputModalities: ["text"],
      roles: ["test_target", "judge"],
    });
    expect(
      catalog
        .find((entry) => entry.id === "builtin-mock-algo")
        ?.parameters.find((parameter) => parameter.name === "num_images")
    ).toMatchObject({
      defaultValue: 1,
      min: 1,
      max: 8,
      required: false,
    });
  });

  it("infers backward-compatible metadata for old projects", () => {
    const text = legacyTarget();
    const imageEdit = legacyTarget({
      id: "legacy-image-edit",
      contentKind: "image",
      inputParams: [
        { name: "prompt", type: "string", required: true },
        { name: "source", type: "image", required: true },
      ],
    });
    const textToImage = legacyTarget({
      id: "legacy-text-to-image",
      contentKind: "image",
      inputParams: [{ name: "prompt", type: "string", required: true }],
    });

    expect(inferResourceKind(text)).toBe("model");
    expect(inferResourceCapabilities(text)).toEqual(["text_understanding"]);
    expect(inferResourceKind(imageEdit)).toBe("algorithm");
    expect(inferResourceCapabilities(imageEdit)).toEqual(["image_editing"]);
    expect(inferResourceCapabilities(textToImage)).toEqual(["text_to_image"]);
  });

  it("honors explicit metadata in canonical order without duplicates", () => {
    const target = legacyTarget({
      resourceKind: "algorithm",
      capabilityTags: [
        "business_algorithm",
        "text_understanding",
        "business_algorithm",
      ],
    });

    expect(inferResourceKind(target)).toBe("algorithm");
    expect(inferResourceCapabilities(target)).toEqual([
      "text_understanding",
      "business_algorithm",
    ]);
    expect(buildResourceCatalog([target])[0].roles).toEqual(["test_target"]);
  });

  it("only exposes tested text models as Judge candidates", () => {
    const unverified = legacyTarget({
      id: "unverified-model",
      status: "unverified",
    });
    const failed = legacyTarget({ id: "failed-model", status: "tested_fail" });
    const ready = legacyTarget({ id: "ready-model" });

    expect(buildResourceCatalog([unverified])[0].roles).toEqual([
      "test_target",
    ]);
    expect(buildResourceCatalog([failed])[0].roles).toEqual(["test_target"]);
    expect(buildResourceCatalog([ready])[0].roles).toEqual([
      "test_target",
      "judge",
    ]);
  });

  it("combines query, kind, role, capability, and modality filters", () => {
    const catalog = buildResourceCatalog([
      legacyTarget({ id: "text-model", name: "客服模型" }),
      legacyTarget({
        id: "image-algo",
        name: "商品图编辑",
        contentKind: "image",
        resourceKind: "algorithm",
        capabilityTags: ["image_editing"],
        inputParams: [{ name: "image", type: "image", required: true }],
      }),
    ]);

    expect(filterResourceCatalog(catalog, { role: "judge" })).toHaveLength(1);
    expect(
      filterResourceCatalog(catalog, {
        kind: "algorithm",
        capability: "image_editing",
        modality: "image",
        query: "商品图",
      }).map((entry) => entry.id)
    ).toEqual(["image-algo"]);
    expect(
      filterResourceCatalog(catalog, {
        kind: "model",
        capability: "image_editing",
      })
    ).toEqual([]);
  });

  it("formats complete and one-sided numeric ranges", () => {
    expect(formatParameterRange({ type: "number", min: 1, max: 8 })).toBe(
      "1–8"
    );
    expect(formatParameterRange({ type: "number", min: 0 })).toBe(">= 0");
    expect(formatParameterRange({ type: "number", max: 100 })).toBe("<= 100");
    expect(formatParameterRange({ type: "string", min: 1, max: 8 })).toBe(
      undefined
    );
  });

  it("formats bounded default values without exposing sensitive parameters", () => {
    expect(
      formatParameterDefault({ name: "num_images", defaultValue: 4 })
    ).toBe("4");
    expect(
      formatParameterDefault({ name: "api_key", defaultValue: "private-value" })
    ).toBe("[REDACTED]");
    expect(
      formatParameterDefault({
        name: "prompt",
        defaultValue: "x".repeat(60),
      })?.endsWith("…")
    ).toBe(true);
  });

  it("drops non-finite range metadata without mutating source configs", () => {
    const target = legacyTarget({
      inputParams: [
        {
          name: "temperature",
          type: "number",
          required: false,
          min: Number.NaN,
          max: Number.POSITIVE_INFINITY,
        },
      ],
    });
    const before = JSON.stringify(target);
    const [entry] = buildResourceCatalog([target]);

    expect(entry.parameters[0]).toMatchObject({
      name: "temperature",
      min: undefined,
      max: undefined,
    });
    expect(JSON.stringify(target)).toBe(before);
  });
});
