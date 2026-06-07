import crypto from "crypto";
import type { ImageItem, TargetConfig } from "@/types";
import { sanitizeCapabilityList, type CapabilityId } from "@/config/capabilities";

/**
 * 方案 B 预置安全能力执行模块（红线）。
 *
 * 红线：所有安全函数由平台写死在此处，AI/用户只能从 capabilities 清单中「勾选」声明，
 * 运行/测试前由本模块按声明依次处理请求；**绝不执行 AI/用户提供的任意代码（非沙箱）**。
 *
 * 扩展方式：往 config/capabilities.ts 加能力项 + 在此处 CAPABILITY_HANDLERS 实现对应函数。
 */

export interface PreprocessContext {
  target: TargetConfig;
  /** 当前请求的参数值（prompt + extraFields），处理函数可读写。 */
  values: Record<string, unknown>;
  /** 输入图片（用于 image_as_url / image_as_base64）。 */
  images?: ImageItem[];
}

export interface PreprocessResult {
  /** 处理后的参数值（注入签名/时间戳等后）。 */
  values: Record<string, unknown>;
  /** 处理过程需要追加的请求头。 */
  extraHeaders: Record<string, string>;
}

type CapabilityHandler = (
  draft: PreprocessResult,
  context: PreprocessContext
) => void | Promise<void>;

const CAPABILITY_HANDLERS: Record<CapabilityId, CapabilityHandler> = {
  timestamp(draft) {
    draft.values.timestamp = Date.now();
  },
  md5_sign(draft, context) {
    const secret = context.target.apiKeyRef
      ? process.env[context.target.apiKeyRef] ?? ""
      : "";
    const raw = canonicalize(draft.values) + secret;
    draft.values.sign = crypto.createHash("md5").update(raw).digest("hex");
  },
  hmac_sha256(draft, context) {
    const secret = context.target.apiKeyRef
      ? process.env[context.target.apiKeyRef] ?? ""
      : "";
    const raw = canonicalize(draft.values);
    draft.values.sign = crypto
      .createHmac("sha256", secret)
      .update(raw)
      .digest("hex");
  },
  two_step_auth() {
    // 占位：两步认证（先换 token 再发请求）在第二批接入真实流程时实现。
    // 当前不抛错，保证架构骨架可编译；声明该能力的目标在第二批补全。
  },
  image_as_url(draft, context) {
    const firstUrl = context.images?.find((image) => image.source === "url");
    if (firstUrl) {
      draft.values.image = firstUrl.value;
    }
  },
  image_as_base64(draft, context) {
    const firstBase64 = context.images?.find(
      (image) => image.source === "base64"
    );
    if (firstBase64) {
      draft.values.image = firstBase64.value;
    }
  },
};

/** 把参数对象按 key 排序后拼成 query 串，用于签名计算。 */
function canonicalize(values: Record<string, unknown>): string {
  return Object.keys(values)
    .sort()
    .filter((key) => key !== "sign")
    .map((key) => `${key}=${String(values[key] ?? "")}`)
    .join("&");
}

/**
 * 按声明的安全能力依次处理请求。
 * preprocess 中非清单内的能力会被自动过滤（红线：只认预置清单）。
 */
export async function applyPreprocess(
  preprocess: string[] | undefined,
  context: PreprocessContext
): Promise<PreprocessResult> {
  const result: PreprocessResult = {
    values: { ...context.values },
    extraHeaders: {},
  };

  const validCapabilities = sanitizeCapabilityList(preprocess);
  for (const capabilityId of validCapabilities) {
    const handler = CAPABILITY_HANDLERS[capabilityId];
    if (handler) {
      await handler(result, context);
    }
  }
  return result;
}
