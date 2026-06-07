import type { ImageItem } from "@/types";

/**
 * base64 图片压缩（仅前端，M9 / PRD 十一）：
 * 把 base64 图片用 canvas 缩放到最长边 ≤ MAX_EDGE 后再编码，仅用于「传给裁判模型的副本」。
 * 结果区与存储始终保留原图，本函数不修改原 ImageItem。
 * URL 图片不压缩（裁判侧自行拉取），原样返回。
 */

const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.8;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败，无法压缩"));
    image.src = src;
  });
}

/** 压缩单张 base64 图片；非 base64（URL）原样返回。 */
async function compressOne(item: ImageItem): Promise<ImageItem> {
  if (item.source !== "base64") return item;

  const image = await loadImage(item.value);
  const { width, height } = image;
  const longestEdge = Math.max(width, height);

  if (longestEdge <= MAX_EDGE) return item;

  const scale = MAX_EDGE / longestEdge;
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) return item;

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  const compressed = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

  return { ...item, value: compressed };
}

/**
 * 压缩一组图片，返回新数组（不修改入参）。任一张压缩失败时回退用原图，保证评价不被中断。
 */
export async function compressImagesForJudge(
  images: ImageItem[]
): Promise<ImageItem[]> {
  return Promise.all(
    images.map(async (item) => {
      try {
        return await compressOne(item);
      } catch {
        return item;
      }
    })
  );
}
