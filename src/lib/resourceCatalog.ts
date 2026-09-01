import type {
  ContentKind,
  ParamDef,
  ResourceCapability,
  ResourceKind,
  ResourceModality,
  TargetConfig,
} from "@/types";
import { redactSensitiveText } from "@/lib/redactSensitive";

export type ResourceRole = "test_target" | "judge";

export interface ResourceParameterProfile {
  name: string;
  type: ParamDef["type"];
  required: boolean;
  defaultValue?: unknown;
  min?: number;
  max?: number;
}

export interface ResourceCatalogEntry {
  id: string;
  name: string;
  kind: ResourceKind;
  roles: ResourceRole[];
  capabilities: ResourceCapability[];
  inputModalities: ResourceModality[];
  outputModalities: ResourceModality[];
  parameters: ResourceParameterProfile[];
  status: TargetConfig["status"];
  source: TargetConfig["source"];
  preset: boolean;
}

export interface ResourceCatalogFilter {
  query?: string;
  kind?: ResourceKind | "all";
  role?: ResourceRole | "all";
  capability?: ResourceCapability | "all";
  modality?: ResourceModality | "all";
}

export const RESOURCE_CAPABILITIES: ReadonlyArray<{
  id: ResourceCapability;
  label: string;
}> = [
  { id: "text_understanding", label: "文本理解" },
  { id: "image_understanding", label: "图片理解" },
  { id: "text_to_image", label: "文生图" },
  { id: "image_editing", label: "图像编辑" },
  { id: "video_generation", label: "视频生成" },
  { id: "business_algorithm", label: "业务算法" },
];

export const RESOURCE_CAPABILITY_LABELS: Record<
  ResourceCapability,
  string
> = Object.fromEntries(
  RESOURCE_CAPABILITIES.map((item) => [item.id, item.label])
) as Record<ResourceCapability, string>;

const CAPABILITY_ORDER = RESOURCE_CAPABILITIES.map((item) => item.id);
const MODALITY_ORDER: ResourceModality[] = [
  "text",
  "image",
  "number",
  "boolean",
];

export function inferResourceKind(
  target: Pick<TargetConfig, "resourceKind" | "type" | "contentKind">
): ResourceKind {
  if (target.resourceKind) return target.resourceKind;
  return target.type === "comfyui" || target.contentKind === "image"
    ? "algorithm"
    : "model";
}

export function inferResourceCapabilities(
  target: Pick<TargetConfig, "capabilityTags" | "contentKind" | "inputParams">
): ResourceCapability[] {
  const explicit = uniqueInOrder(
    target.capabilityTags ?? [],
    CAPABILITY_ORDER
  );
  if (explicit.length > 0) return explicit;

  if (target.contentKind === "multimodal") {
    return ["text_understanding", "image_understanding"];
  }
  if (target.contentKind === "text") return ["text_understanding"];
  return target.inputParams.some((param) => param.type === "image")
    ? ["image_editing"]
    : ["text_to_image"];
}

export function buildResourceCatalog(
  configs: readonly TargetConfig[]
): ResourceCatalogEntry[] {
  return configs.map((config) => {
    const kind = inferResourceKind(config);
    const inputModalities = uniqueInOrder(
      config.inputParams.map(paramTypeToModality),
      MODALITY_ORDER
    );
    const outputModalities: ResourceModality[] =
      config.contentKind === "image" ? ["image"] : ["text"];
    const roles: ResourceRole[] = ["test_target"];
    if (
      kind === "model" &&
      config.status === "tested_ok" &&
      canActAsJudge(config.contentKind)
    ) {
      roles.push("judge");
    }

    return {
      id: config.id,
      name: config.name.trim() || config.id,
      kind,
      roles,
      capabilities: inferResourceCapabilities(config),
      inputModalities,
      outputModalities,
      parameters: config.inputParams.map(toParameterProfile),
      status: config.status,
      source: config.source,
      preset: Boolean(config.preset),
    };
  });
}

export function filterResourceCatalog(
  entries: readonly ResourceCatalogEntry[],
  filters: ResourceCatalogFilter
): ResourceCatalogEntry[] {
  const query = filters.query?.trim().toLocaleLowerCase("zh-CN") ?? "";
  return entries.filter((entry) => {
    if (filters.kind && filters.kind !== "all" && entry.kind !== filters.kind) {
      return false;
    }
    if (
      filters.role &&
      filters.role !== "all" &&
      !entry.roles.includes(filters.role)
    ) {
      return false;
    }
    if (
      filters.capability &&
      filters.capability !== "all" &&
      !entry.capabilities.includes(filters.capability)
    ) {
      return false;
    }
    if (
      filters.modality &&
      filters.modality !== "all" &&
      !entry.inputModalities.includes(filters.modality) &&
      !entry.outputModalities.includes(filters.modality)
    ) {
      return false;
    }
    if (!query) return true;
    const searchable = [
      entry.id,
      entry.name,
      entry.kind,
      ...entry.roles,
      ...entry.capabilities.map((item) => RESOURCE_CAPABILITY_LABELS[item]),
    ]
      .join(" ")
      .toLocaleLowerCase("zh-CN");
    return searchable.includes(query);
  });
}

export function formatParameterRange(
  parameter: Pick<ResourceParameterProfile, "type" | "min" | "max">
): string | undefined {
  if (parameter.type !== "number") return undefined;
  if (parameter.min !== undefined && parameter.max !== undefined) {
    return `${parameter.min}–${parameter.max}`;
  }
  if (parameter.min !== undefined) return `>= ${parameter.min}`;
  if (parameter.max !== undefined) return `<= ${parameter.max}`;
  return undefined;
}

export function formatParameterDefault(
  parameter: Pick<ResourceParameterProfile, "name" | "defaultValue">
): string | undefined {
  if (parameter.defaultValue === undefined) return undefined;

  let serialized: string;
  if (typeof parameter.defaultValue === "string") {
    serialized = parameter.defaultValue;
  } else {
    try {
      serialized = JSON.stringify(parameter.defaultValue) ?? String(parameter.defaultValue);
    } catch {
      serialized = "[无法展示]";
    }
  }

  const prefix = `${parameter.name}=`;
  const redacted = redactSensitiveText(`${prefix}${serialized}`);
  const safeValue = redacted.startsWith(prefix)
    ? redacted.slice(prefix.length)
    : redacted;
  return safeValue.length > 48 ? `${safeValue.slice(0, 47)}…` : safeValue;
}

function canActAsJudge(contentKind: ContentKind): boolean {
  return contentKind === "text" || contentKind === "multimodal";
}

function paramTypeToModality(param: ParamDef): ResourceModality {
  return param.type === "string" ? "text" : param.type;
}

function toParameterProfile(param: ParamDef): ResourceParameterProfile {
  return {
    name: param.name,
    type: param.type,
    required: param.required,
    defaultValue: param.defaultValue,
    min: finiteOrUndefined(param.min),
    max: finiteOrUndefined(param.max),
  };
}

function finiteOrUndefined(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

function uniqueInOrder<T>(values: readonly T[], order: readonly T[]): T[] {
  const selected = new Set(values);
  return order.filter((item) => selected.has(item));
}
