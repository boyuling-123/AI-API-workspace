"use client";

import type { TaskInput } from "@/types";
import { ImageInput } from "@/components/ImageInput";

interface SingleInputProps {
  input: TaskInput;
  onChange: (updater: (current: TaskInput) => TaskInput) => void;
}

export function SingleInput({ input, onChange }: SingleInputProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Prompt</label>
        <textarea
          value={input.prompt}
          onChange={(event) =>
            onChange((current) => ({ ...current, prompt: event.target.value }))
          }
          rows={5}
          className="w-full resize-y rounded-md border border-gray-300 p-3 text-sm focus:border-gray-500 focus:outline-none"
          placeholder="输入 prompt..."
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">图片（可选）</label>
        <ImageInput
          images={input.images}
          onChange={(images) =>
            onChange((current) => ({ ...current, images }))
          }
        />
      </div>
    </div>
  );
}
