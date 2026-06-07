import Dexie, { type Table } from "dexie";
import type { ContentMode, RunMode, TaskInput } from "@/types";

/** 兼容旧命名：RunMode 即原 InputMode（single / batch）。 */
export type InputMode = RunMode;

/**
 * 输入草稿（编辑态），按 projectId + contentMode + runMode 四维隔离持久化（v4 M3）。
 * text/image × single/batch 共 4 套草稿各自独立存储，任意切换互不覆盖；刷新可恢复。
 * 不进入 Project 的 JSON 导出。
 */
export interface InputDraft {
  key: string;
  projectId: string;
  contentMode: ContentMode;
  runMode: RunMode;
  inputs: TaskInput[];
  updateTime: number;
}

/**
 * 已选目标（targetIds），跟随项目（不分 single/batch）。
 * 独立持久化，不进入 Project 的 JSON 导出。
 */
export interface TargetSelectionDraft {
  key: string;
  projectId: string;
  targetIds: string[];
  updateTime: number;
}

class DraftDb extends Dexie {
  drafts!: Table<InputDraft, string>;
  targets!: Table<TargetSelectionDraft, string>;

  constructor() {
    super("eval-platform-drafts");
    this.version(1).stores({
      drafts: "key, projectId",
    });
    this.version(2).stores({
      drafts: "key, projectId",
      targets: "key, projectId",
    });
  }
}

const draftDb = new DraftDb();

export function buildDraftKey(
  projectId: string,
  contentMode: ContentMode,
  runMode: RunMode
): string {
  return `${projectId}:${contentMode}:${runMode}`;
}

export async function getDraft(
  projectId: string,
  contentMode: ContentMode,
  runMode: RunMode
): Promise<InputDraft | undefined> {
  return draftDb.drafts.get(buildDraftKey(projectId, contentMode, runMode));
}

export async function saveDraft(draft: InputDraft): Promise<void> {
  await draftDb.drafts.put(draft);
}

export async function getTargetSelection(
  projectId: string
): Promise<string[]> {
  const record = await draftDb.targets.get(`${projectId}:targets`);
  return record?.targetIds ?? [];
}

export async function saveTargetSelection(
  projectId: string,
  targetIds: string[]
): Promise<void> {
  await draftDb.targets.put({
    key: `${projectId}:targets`,
    projectId,
    targetIds,
    updateTime: Date.now(),
  });
}
