/**
 * 电子宠物（像素小狗）漫游/外观可调参数（PRD v4.7）。
 * 纯前端常量，与业务无关，集中此处便于调整手感。
 */
export const PET_CONFIG = {
  /** 像素画布放大倍数（小狗尺寸 = 16 * scale）。 */
  scale: 5,
  /** sprite 像素列数。 */
  spriteCols: 16,
  /** 工作区内容最大宽度（与 WorkspaceBody 的 max-w-3xl 对齐，px）。 */
  contentMaxWidth: 768,
  /** 单侧留白宽度超过此阈值才进入漫游模式，否则退回角落（px）。
   * 取较小值，让常规桌面窗口都能进入漫游（留白不足才退回角落）。 */
  roamThreshold: 24,
  /** 漫游移动速度（px / 秒），慢速平滑。 */
  walkSpeed: 28,
  /** 被发现后逃回空白处的速度（px / 秒），明显更快。 */
  fleeSpeed: 220,
  /** 两侧空白区各占视口宽度的比例（左 20% + 右 20% = 40%，中间 60% 为工作区）。 */
  sideZoneRatio: 0.2,
  /** 漫游选点时溜进中间工作区的概率（其余时间都待在两侧空白）。 */
  centerRoamChance: 0.05,
  /** 在两侧空白活动时，切换到对侧空白的概率（其余时间留在当前同侧小范围溜达，
   * 避免频繁左右横穿而途经中间工作区）。 */
  switchSideChance: 0.15,
  /** 到达目标点后的停顿区间（毫秒），随机取。 */
  pauseMinMs: 1500,
  pauseMaxMs: 4500,
  /** walk 帧切换间隔（毫秒）。 */
  walkFrameMs: 220,
  /** 漫游竖带距视口上下边的内边距（px）。 */
  verticalPadding: 60,
  /** 角落待机时距右下角的偏移（px）。 */
  cornerMargin: 16,
  /** 用户拖动松手后，停留多久（毫秒）自动恢复漫游。 */
  resumeAfterDragMs: 3000,
} as const;
