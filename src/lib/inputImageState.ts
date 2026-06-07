import type { TaskInput } from "@/types";

export interface InputImageState {
  hasImage: boolean;
  hasBase64Image: boolean;
}

/**
 * 汇总当前输入的图片状态，用于目标选择置灰判断。
 * 单条模式传 [singleInput]，批量模式传 batchInputs。
 */
export function computeInputImageState(inputs: TaskInput[]): InputImageState {
  let hasImage = false;
  let hasBase64Image = false;

  for (const input of inputs) {
    for (const image of input.images) {
      hasImage = true;
      if (image.source === "base64") {
        hasBase64Image = true;
      }
    }
  }

  return { hasImage, hasBase64Image };
}
