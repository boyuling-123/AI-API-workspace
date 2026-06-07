/**
 * 方案 B 预置安全能力清单（v4）。
 *
 * 红线（务必遵守）：
 *  - 这是平台开发预先写死的安全能力清单，AI 解析或用户**只能从清单中勾选/声明**，
 *    勾选结果写入 TargetConfig.requestTemplate.preprocess[]。
 *  - 运行/测试时，平台在发请求前按 preprocess[] 依次调用对应的平台自有安全函数处理请求
 *    （注入签名/时间戳/完成两步认证/转换图片编码等）。
 *  - AI/用户只有「勾选权」无「创造权」；**绝不执行 AI/用户提供的任意代码（非沙箱）**。
 *
 * 扩展方式：往本清单加一个能力项 + 在 services/preprocess/ 实现对应函数即可。
 */

export type CapabilityId =
  | "md5_sign"
  | "hmac_sha256"
  | "timestamp"
  | "two_step_auth"
  | "image_as_url"
  | "image_as_base64";

export interface CapabilityDef {
  id: CapabilityId;
  name: string;
  desc: string;
}

export const CAPABILITIES: CapabilityDef[] = [
  { id: "md5_sign", name: "MD5 签名", desc: "对请求参数按约定规则做 MD5 签名并注入。" },
  { id: "hmac_sha256", name: "HMAC-SHA256 签名", desc: "用密钥对请求做 HMAC-SHA256 签名并注入。" },
  { id: "timestamp", name: "时间戳", desc: "注入当前时间戳（秒/毫秒）到请求参数或请求头。" },
  { id: "two_step_auth", name: "两步认证", desc: "先换取临时 token，再用 token 发起业务请求。" },
  { id: "image_as_url", name: "图片转 URL", desc: "把输入图片以 URL 形式提交。" },
  { id: "image_as_base64", name: "图片转 Base64", desc: "把输入图片以 Base64 形式提交。" },
];

const CAPABILITY_IDS = new Set<string>(CAPABILITIES.map((capability) => capability.id));

/** 校验一个 preprocess 声明是否全部取自预置清单（红线校验）。 */
export function isValidCapabilityList(preprocess: string[] | undefined): boolean {
  if (!preprocess) {
    return true;
  }
  return preprocess.every((id) => CAPABILITY_IDS.has(id));
}

/** 过滤掉不在清单内的非法能力声明，仅保留合法项。 */
export function sanitizeCapabilityList(preprocess: string[] | undefined): CapabilityId[] {
  if (!preprocess) {
    return [];
  }
  return preprocess.filter((id): id is CapabilityId => CAPABILITY_IDS.has(id));
}
