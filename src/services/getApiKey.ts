/**
 * Key 来源抽象。
 * - 不传 keyRef：内置大模型走 DashScope 百炼，使用 DASHSCOPE_API_KEY。
 * - 传 keyRef：用户接入的算法 API，按其 apiKeyRef 引用名从 .env.local 读取真值。
 *
 * 设计约束：key 真值绝不落前端，前端只存引用名，服务端按名注入。
 */
export function getApiKey(keyRef?: string): string {
  if (keyRef) {
    const referenced = process.env[keyRef];
    if (!referenced) {
      throw new Error(
        `缺少环境变量 ${keyRef}，请在 .env.local 中配置该接入 API 的 Key`
      );
    }
    return referenced;
  }

  const dashscopeKey = process.env.DASHSCOPE_API_KEY;
  if (!dashscopeKey) {
    throw new Error(
      "缺少环境变量 DASHSCOPE_API_KEY，请在 .env.local 中配置百炼 API Key"
    );
  }
  return dashscopeKey;
}
