import type { TargetConfig } from "@/types";
import { getDefaultTargetConfigs } from "@/config/presetTargets";

/**
 * 兼容层（v4）：内置目标已迁移到 config/presetTargets.ts 以 TargetConfig 形态表达。
 * 此处仅重导出，保留旧引用入口，避免一次性改动所有调用点。
 *
 * 新建项目时塞入这些默认目标；用户可自由编辑/删除，删掉后不自动恢复，新建项目才重新生成。
 */

/** 新建项目时的默认目标（预置大模型 + Mock 算法）。 */
export function getDefaultTargets(): TargetConfig[] {
  return getDefaultTargetConfigs();
}
