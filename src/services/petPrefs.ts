/**
 * 电子宠物偏好持久化（PRD v4.6）：显示/隐藏、拖动位置、聊天彩蛋开关。
 * 单独存 localStorage，不进 Project / 不进 SCHEMA_VERSION，与核心数据完全隔离。
 */

export interface PetPrefs {
  /** 是否显示宠物，默认 true。 */
  visible: boolean;
  /** 拖动后的位置（相对视口左上角的像素坐标）。未拖动则缺省。 */
  position?: { x: number; y: number };
  /** 是否开启真聊天彩蛋，默认 false（本期可不做）。 */
  chatEnabled?: boolean;
  /** 是否允许自主漫游，默认 true。关闭后小狗在角落静止待机。 */
  roamEnabled?: boolean;
  /** 漫游时到达目标点后的停顿时长档位（毫秒），由设置面板调整。 */
  pauseDurationMs?: number;
}

const STORAGE_KEY = "pet-prefs";

const DEFAULT_PREFS: PetPrefs = {
  visible: true,
  chatEnabled: false,
  roamEnabled: true,
};

/** 读取宠物偏好；无记录或解析失败时返回默认值。 */
export function loadPetPrefs(): PetPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<PetPrefs>;
    return {
      visible: typeof parsed.visible === "boolean" ? parsed.visible : true,
      position:
        parsed.position &&
        typeof parsed.position.x === "number" &&
        typeof parsed.position.y === "number"
          ? parsed.position
          : undefined,
      chatEnabled:
        typeof parsed.chatEnabled === "boolean" ? parsed.chatEnabled : false,
      roamEnabled:
        typeof parsed.roamEnabled === "boolean" ? parsed.roamEnabled : true,
      pauseDurationMs:
        typeof parsed.pauseDurationMs === "number" ? parsed.pauseDurationMs : undefined,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** 保存宠物偏好（整体覆盖写入）。 */
export function savePetPrefs(prefs: PetPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage 不可用（隐私模式等）时静默忽略，不影响主流程。
  }
}
