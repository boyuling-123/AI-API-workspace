import type { DimensionPreset } from "@/types";

/**
 * 内置预设维度集（v4.5）：按常见测评场景预置一组维度，供用户一键选用后再增删改。
 * 每个维度由 Judge 独立打分，最终策略由用户确认。可按需扩展更多预设。
 */
export const DIMENSION_PRESETS: DimensionPreset[] = [
  {
    id: "general",
    name: "通用质量",
    scene: "不限场景的通用文本质量评估",
    dimensions: [
      { name: "准确性", desc: "内容是否正确、无事实错误或逻辑漏洞" },
      { name: "完整性", desc: "是否完整回应了需求，无关键信息缺失" },
      { name: "清晰度", desc: "表达是否清楚易懂、结构是否条理分明" },
      { name: "相关性", desc: "输出是否紧扣输入要求，无答非所问或冗余" },
    ],
  },
  {
    id: "translation",
    name: "翻译质量",
    scene: "评估翻译类输出的质量",
    dimensions: [
      { name: "忠实度", desc: "译文是否准确传达原文含义，无漏译误译" },
      { name: "流畅度", desc: "译文是否符合目标语言表达习惯、自然通顺" },
      { name: "术语准确", desc: "专业术语、专有名词是否翻译规范一致" },
      { name: "语气还原", desc: "是否保留原文的语气、风格与情感" },
    ],
  },
  {
    id: "copywriting",
    name: "营销文案",
    scene: "评估商品/营销文案的吸引力与转化力",
    dimensions: [
      { name: "吸引力", desc: "文案是否抓眼球、能激发兴趣" },
      { name: "卖点突出", desc: "核心卖点是否清晰有力地呈现" },
      { name: "信息完整", desc: "关键信息（价格/规格/活动等）是否齐全" },
      { name: "合规性", desc: "是否避免夸大、违禁词等合规风险" },
    ],
  },
  {
    id: "customer-service",
    name: "客服应答",
    scene: "评估智能客服/对话类回复的质量",
    dimensions: [
      { name: "问题解决", desc: "是否切实解决了用户的问题或诉求" },
      { name: "态度友好", desc: "语气是否礼貌、有同理心、体验良好" },
      { name: "准确性", desc: "提供的信息是否正确、无误导" },
      { name: "简洁性", desc: "回复是否精炼、不啰嗦、重点突出" },
    ],
  },
  {
    id: "image-gen",
    name: "图像生成",
    scene: "评估文生图/图生图类输出",
    dimensions: [
      { name: "符合描述", desc: "图像是否准确呈现了 prompt 描述的内容" },
      { name: "画面质量", desc: "清晰度、构图、光影、细节是否精良" },
      { name: "美观度", desc: "整体视觉效果是否好看、有美感" },
      { name: "无瑕疵", desc: "是否无明显畸变、错误肢体、伪影等问题" },
    ],
  },
];

/** 按 id 取预设维度集，找不到返回 undefined。 */
export function getDimensionPreset(id: string): DimensionPreset | undefined {
  return DIMENSION_PRESETS.find((preset) => preset.id === id);
}
