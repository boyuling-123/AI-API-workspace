export const RUNTIME_CONFIG = {
  defaultConcurrency: 3,
  maxConcurrency: 10,
  /** 跑批默认平滑限速；用户可设为 0 表示不限速。 */
  defaultQps: 5,
  maxQps: 100,
  defaultRunTimeoutMs: 60_000,
  minRunTimeoutMs: 1_000,
  maxRunTimeoutMs: 60_000,
  defaultRunRetryLimit: 1,
  maxRunRetryLimit: 3,
  retryBaseDelayMs: 250,
  callTimeoutMs: 60_000,
  bodyLimit: "25mb",
  maxTokens: 1024,
  /** 接入「测试一次」失败后的重试上限（v4 方案，可调）。 */
  testRetryLimit: 3,
  /** 生图单张预估费用（元/张），用于运行前费用确认弹框估算。可按实际算法计费调整。 */
  imageUnitPriceYuan: 0.2,
  /** 脚本产物（图片等）的本地临时落地根目录。 */
  scriptOutputRoot: "./outputs",
  /** 脚本子进程执行超时（毫秒），超时杀进程（Windows 杀进程树）。 */
  scriptTimeoutMs: 60_000,
  /** 生图类脚本执行超时（毫秒），比普通脚本放宽（v4.4）。 */
  scriptImageTimeoutMs: 120_000,
  // DashScope Anthropic 兼容网关 base_url。
  // 默认华北2（北京）；可用环境变量 DASHSCOPE_BASE_URL 覆盖为其他区域。
  dashscopeBaseUrl:
    process.env.DASHSCOPE_BASE_URL ??
    "https://dashscope.aliyuncs.com/apps/anthropic",
} as const;

// 可选区域，供探测/切换参考
export const DASHSCOPE_REGION_BASE_URLS = {
  beijing: "https://dashscope.aliyuncs.com/apps/anthropic",
  singapore: "https://dashscope-intl.aliyuncs.com/apps/anthropic",
  us: "https://dashscope-us.aliyuncs.com/apps/anthropic",
} as const;
