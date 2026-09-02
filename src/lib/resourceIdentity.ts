import type { TargetConfig } from "@/types";

const MAX_RESOURCE_VERSION_LENGTH = 64;
const MAX_RESOURCE_ALIAS_COUNT = 12;
const RESOURCE_ALIAS_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,39}$/;

export interface ResourceIdentityValidation {
  ok: boolean;
  version?: string;
  aliases: string[];
  issues: string[];
}

export function parseResourceAliasText(value: string): string[] {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeResourceVersion(
  value: string | null | undefined
): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function normalizeResourceAliases(
  values: readonly string[] | null | undefined
): string[] {
  const aliases: string[] = [];
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const normalized = value.trim().toLocaleLowerCase("en-US");
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    aliases.push(normalized);
  }
  return aliases;
}

export function validateResourceIdentity(input: {
  targetId: string;
  version?: string | null;
  aliases?: readonly string[] | null;
  existingConfigs?: readonly TargetConfig[];
}): ResourceIdentityValidation {
  const version = normalizeResourceVersion(input.version);
  const rawAliases = (input.aliases ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  const aliases = normalizeResourceAliases(rawAliases);
  const issues: string[] = [];

  if (
    version &&
    (version.length > MAX_RESOURCE_VERSION_LENGTH || /[\r\n]/.test(version))
  ) {
    issues.push(`资源版本最多 ${MAX_RESOURCE_VERSION_LENGTH} 个字符且不能换行`);
  }
  if (rawAliases.length > MAX_RESOURCE_ALIAS_COUNT) {
    issues.push(`资源别名最多 ${MAX_RESOURCE_ALIAS_COUNT} 个`);
  }
  if (aliases.length !== rawAliases.length) {
    issues.push("资源别名不能重复");
  }

  const targetKey = canonicalResourceKey(input.targetId);
  for (const alias of aliases) {
    if (!RESOURCE_ALIAS_PATTERN.test(alias)) {
      issues.push(
        `别名 ${alias} 格式无效，仅支持小写字母、数字、点、下划线、斜杠和短横线`
      );
      continue;
    }
    if (canonicalResourceKey(alias) === targetKey) {
      issues.push(`别名 ${alias} 与当前资源 ID 重复`);
    }
  }

  const reserved = buildReservedResourceKeys(
    input.existingConfigs ?? [],
    input.targetId
  );
  const targetOwner = reserved.get(targetKey);
  if (targetOwner) {
    issues.push(`资源 ID ${input.targetId} 已被资源 ${targetOwner} 使用`);
  }
  for (const alias of aliases) {
    const owner = reserved.get(canonicalResourceKey(alias));
    if (owner) issues.push(`别名 ${alias} 已被资源 ${owner} 使用`);
  }

  return {
    ok: issues.length === 0,
    version,
    aliases,
    issues: uniqueStrings(issues),
  };
}

export function inspectResourceIdentityIssues(
  target: TargetConfig,
  allConfigs: readonly TargetConfig[]
): string[] {
  return validateResourceIdentity({
    targetId: target.id,
    version: target.resourceVersion,
    aliases: target.resourceAliases,
    existingConfigs: allConfigs,
  }).issues;
}

export function buildTargetInvocationFingerprint(target: TargetConfig): string {
  return canonicalStringify({
    type: target.type,
    contentKind: target.contentKind,
    inputParams: target.inputParams,
    requestTemplate: target.requestTemplate,
    script: target.script,
    comfyui: target.comfyui,
    apiKeyRef: target.apiKeyRef,
  });
}

function buildReservedResourceKeys(
  configs: readonly TargetConfig[],
  excludedTargetId: string
): Map<string, string> {
  const reserved = new Map<string, string>();
  for (const config of configs) {
    if (config.id === excludedTargetId) continue;
    reserved.set(canonicalResourceKey(config.id), config.name.trim() || config.id);
    for (const alias of normalizeResourceAliases(config.resourceAliases)) {
      reserved.set(canonicalResourceKey(alias), config.name.trim() || config.id);
    }
  }
  return reserved;
}

function canonicalResourceKey(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function canonicalStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`)
    .join(",")}}`;
}
