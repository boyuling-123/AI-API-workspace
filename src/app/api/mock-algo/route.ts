import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * 内置 mock 算法 API：模拟一个生图算法服务，供 M8a 演示异构混选与接入链路。
 * 入参 prompt（文本）+ num_images（生成张数），返回结构化结果：
 *   { code, data: { caption, images: string[] } }
 * 图片用占位 SVG（data URL）按数量返回，无需真实生图依赖。
 */
interface MockAlgoBody {
  prompt?: string;
  num_images?: number;
}

function buildPlaceholderImage(index: number, prompt: string): string {
  const label = `#${index + 1}`;
  const safePrompt = prompt.slice(0, 18).replace(/[<>&]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">
    <rect width="320" height="320" fill="hsl(${(index * 67) % 360},70%,55%)"/>
    <text x="160" y="150" font-size="48" fill="white" text-anchor="middle" font-family="sans-serif">${label}</text>
    <text x="160" y="200" font-size="18" fill="white" text-anchor="middle" font-family="sans-serif">${safePrompt}</text>
  </svg>`;
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

export async function POST(request: Request) {
  let body: MockAlgoBody;
  try {
    body = (await request.json()) as MockAlgoBody;
  } catch {
    return NextResponse.json({ code: 400, message: "JSON 解析失败" }, { status: 400 });
  }

  const prompt = body.prompt ?? "";
  const count = Math.min(Math.max(Number(body.num_images) || 1, 1), 8);

  await new Promise((resolve) => setTimeout(resolve, 300));

  const images = Array.from({ length: count }, (_, index) =>
    buildPlaceholderImage(index, prompt)
  );

  return NextResponse.json({
    code: 0,
    data: {
      caption: `已根据「${prompt}」生成 ${count} 张图（mock）`,
      images,
    },
  });
}
