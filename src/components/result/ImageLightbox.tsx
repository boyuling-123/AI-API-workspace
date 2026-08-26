"use client";

import { useEffect } from "react";

interface ImageLightboxProps {
  src: string | null;
  onClose: () => void;
}

export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!src) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [src, onClose]);

  if (!src) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Output may use a data URL or an arbitrary user endpoint. */}
      <img
        src={src}
        alt="放大查看"
        className="max-h-full max-w-full rounded-md object-contain"
        onClick={(event) => event.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 rounded-full bg-white/90 px-3 py-1 text-sm text-gray-700 transition hover:bg-white"
      >
        关闭 ✕
      </button>
    </div>
  );
}
