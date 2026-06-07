import type { Project } from "@/types";
import { SCHEMA_VERSION } from "@/types";
import { generateId } from "@/lib/id";

export function createEmptyProject(name = "未命名项目"): Project {
  const now = Date.now();
  return {
    id: generateId(),
    version: SCHEMA_VERSION,
    name,
    createTime: now,
    updateTime: now,
    endpoints: [], // v4.8: 初始化为空，由用户在接口管理中配置
    tasks: [],
    evaluations: [],
  };
}
