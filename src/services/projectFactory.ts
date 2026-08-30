import type { Project } from "@/types";
import { SCHEMA_VERSION } from "@/types";
import { generateId } from "@/lib/id";
import { getDefaultTargets } from "@/config/builtinAlgos";

export function createEmptyProject(name = "未命名项目"): Project {
  const now = Date.now();
  return {
    id: generateId(),
    version: SCHEMA_VERSION,
    name,
    createTime: now,
    updateTime: now,
    targetConfigs: getDefaultTargets(),
    tasks: [],
    evaluations: [],
    evaluatorVersions: [],
    goldenDatasetVersions: [],
    judgeCalibrationRuns: [],
    evaluatorReleases: [],
    calibrationReviewEvents: [],
  };
}
