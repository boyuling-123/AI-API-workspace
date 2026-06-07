"use client";

import { useRef, useState } from "react";
import type { ImageItem } from "@/types";
import { generateId } from "@/lib/id";

interface ImageInputProps {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
}

type ImageTab = "upload" | "url";

export function ImageInput({ images, onChange }: ImageInputProps) {
  const [tab, setTab] = useState<ImageTab>("upload");
  const [urlValue, setUrlValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const newItems = await Promise.all(
      Array.from(fileList).map((file) => readFileAsImageItem(file))
    );
    onChange([...images, ...newItems]);
  }

  function handleAddUrl() {
    const trimmed = urlValue.trim();
    if (!trimmed) {
      return;
    }
    const item: ImageItem = {
      id: generateId(),
      name: trimmed.split("/").pop() ?? "image",
      source: "url",
      value: trimmed,
    };
    onChange([...images, item]);
    setUrlValue("");
  }

  function handleRemove(id: string) {
    onChange(images.filter((image) => image.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
          本地上传
        </TabButton>
        <TabButton active={tab === "url"} onClick={() => setTab("url")}>
          图片 URL
        </TabButton>
      </div>

      {tab === "upload" && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => handleFiles(event.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 transition hover:border-gray-400"
          >
            + 选择本地图片（可多选）
          </button>
        </div>
      )}

      {tab === "url" && (
        <div className="flex gap-2">
          <input
            value={urlValue}
            onChange={(event) => setUrlValue(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleAddUrl()}
            placeholder="粘贴图片 URL 后回车或点添加"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddUrl}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm transition hover:bg-gray-50"
          >
            添加
          </button>
        </div>
      )}

      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((image) => (
            <div
              key={image.id}
              className="relative h-20 w-20 overflow-hidden rounded-md border border-gray-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.value}
                alt={image.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(image.id)}
                className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center bg-black/60 text-xs text-white"
                aria-label="删除图片"
              >
                ×
              </button>
              <span className="absolute bottom-0 left-0 right-0 truncate bg-black/40 px-1 text-[10px] text-white">
                {image.source}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm transition ${
        active
          ? "bg-black text-white"
          : "border border-gray-300 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function readFileAsImageItem(file: File): Promise<ImageItem> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: generateId(),
        name: file.name,
        source: "base64",
        value: String(reader.result),
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
