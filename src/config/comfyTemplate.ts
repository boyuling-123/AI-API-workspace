/**
 * ComfyUI 固定工作流模板（v4 收窄形态：LoRA + prompt + checkpoint）。
 *
 * 约束：
 *  - 本期不支持任意工作流，不解析用户工作流，无 nodeMappings/workflowJson 概念。
 *  - 平台内置这一份固定模板，运行时把 checkpoint / LoRA / prompt 拼装进去后提交 ComfyUI /prompt。
 *  - 占位符在运行时由 comfyuiAdapter 替换。
 */

export interface ComfyTemplateParams {
  baseModel: string;
  prompt: string;
  loraName?: string;
  loraWeight?: number;
}

/** 节点 id 约定（与下方模板保持一致，便于运行时按需修改/删除 LoRA 节点）。 */
export const COMFY_NODE_IDS = {
  checkpoint: "1",
  lora: "2",
  positivePrompt: "3",
  negativePrompt: "4",
  emptyLatent: "5",
  ksampler: "6",
  vaeDecode: "7",
  saveImage: "8",
} as const;

/**
 * 构造 ComfyUI /prompt 接口所需的 workflow（prompt 字段）。
 * 当 loraName 为空时，自动跳过 LoRA 节点、模型直连。
 */
export function buildComfyWorkflow(params: ComfyTemplateParams): Record<string, unknown> {
  const { baseModel, prompt, loraName, loraWeight = 1.0 } = params;
  const useLora = Boolean(loraName);

  const checkpointNode = {
    [COMFY_NODE_IDS.checkpoint]: {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: baseModel },
    },
  };

  const loraNode = useLora
    ? {
        [COMFY_NODE_IDS.lora]: {
          class_type: "LoraLoader",
          inputs: {
            lora_name: loraName,
            strength_model: loraWeight,
            strength_clip: loraWeight,
            model: [COMFY_NODE_IDS.checkpoint, 0],
            clip: [COMFY_NODE_IDS.checkpoint, 1],
          },
        },
      }
    : {};

  const modelSource = useLora
    ? [COMFY_NODE_IDS.lora, 0]
    : [COMFY_NODE_IDS.checkpoint, 0];
  const clipSource = useLora
    ? [COMFY_NODE_IDS.lora, 1]
    : [COMFY_NODE_IDS.checkpoint, 1];

  return {
    ...checkpointNode,
    ...loraNode,
    [COMFY_NODE_IDS.positivePrompt]: {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: clipSource },
    },
    [COMFY_NODE_IDS.negativePrompt]: {
      class_type: "CLIPTextEncode",
      inputs: { text: "", clip: clipSource },
    },
    [COMFY_NODE_IDS.emptyLatent]: {
      class_type: "EmptyLatentImage",
      inputs: { width: 1024, height: 1024, batch_size: 1 },
    },
    [COMFY_NODE_IDS.ksampler]: {
      class_type: "KSampler",
      inputs: {
        seed: Math.floor(Math.random() * 1_000_000_000),
        steps: 20,
        cfg: 7,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: modelSource,
        positive: [COMFY_NODE_IDS.positivePrompt, 0],
        negative: [COMFY_NODE_IDS.negativePrompt, 0],
        latent_image: [COMFY_NODE_IDS.emptyLatent, 0],
      },
    },
    [COMFY_NODE_IDS.vaeDecode]: {
      class_type: "VAEDecode",
      inputs: {
        samples: [COMFY_NODE_IDS.ksampler, 0],
        vae: [COMFY_NODE_IDS.checkpoint, 2],
      },
    },
    [COMFY_NODE_IDS.saveImage]: {
      class_type: "SaveImage",
      inputs: { filename_prefix: "eval", images: [COMFY_NODE_IDS.vaeDecode, 0] },
    },
  };
}
