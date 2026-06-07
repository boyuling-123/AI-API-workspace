/**
 * 电子宠物（小猪助手）全局状态事件总线（PRD v4.6 彩蛋）。
 *
 * 设计目标：与核心业务完全解耦——业务侧在运行/接入/评价的状态变化时，
 * 仅"广播"一个轻量事件；宠物组件订阅后据此切表情/说台词。
 * 总线只传状态，绝不读写任何业务数据，关闭宠物后业务一切照常。
 */

/** 宠物可呈现的状态（blink 是 idle 下的随机眨眼动画，不在此枚举）。 */
export type PetStatus = "idle" | "busy" | "happy" | "sad";

/** 业务广播的事件载荷：状态 + 可选场景（用于挑选更贴合的台词分组）。 */
export interface PetStatusEvent {
  status: PetStatus;
  /** 场景标识，用于台词分组定向（如 run/agent/evaluate）。缺省走通用台词。 */
  scene?: "run" | "agent" | "evaluate";
}

const PET_STATUS_EVENT = "pet-status";

/**
 * 广播宠物状态。业务侧在状态变化处调用，纯发送、不关心是否有人监听
 * （宠物可能被用户隐藏或未挂载，此时事件被静默丢弃，无副作用）。
 */
export function emitPetStatus(event: PetStatusEvent): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PetStatusEvent>(PET_STATUS_EVENT, { detail: event }));
}

/** 订阅宠物状态事件，返回取消订阅函数。仅宠物组件使用。 */
export function subscribePetStatus(
  handler: (event: PetStatusEvent) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (raw: Event) => {
    const custom = raw as CustomEvent<PetStatusEvent>;
    if (custom.detail) handler(custom.detail);
  };
  window.addEventListener(PET_STATUS_EVENT, listener);
  return () => window.removeEventListener(PET_STATUS_EVENT, listener);
}
