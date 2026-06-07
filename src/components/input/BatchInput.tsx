"use client";

import { useRef, useState } from "react";
import type { BaseModelConfig, ContentMode, TaskInput } from "@/types";
import { generateId } from "@/lib/id";
import {
  downloadImportTemplate,
  parseImportedExcel,
} from "@/services/excel";
import { GenDataPanel } from "./GenDataPanel";

interface BatchInputProps {
  projectName: string;
  inputs: TaskInput[];
  onChange: (inputs: TaskInput[]) => void;
  /** 当前内容模式，传给 AI 造数据决定生成文本/生图数据。 */
  contentMode: ContentMode;
  /** 选中目标所需列，作为 AI 造数据的列约束。 */
  targetColumns: string[];
  /** v4.8：AI 造数据可用的基础大模型候选（已按内容模式过滤）。 */
  genDataModels: { id: string; name: string; baseModel: BaseModelConfig }[];
}

export function BatchInput({
  projectName,
  inputs,
  onChange,
  contentMode,
  targetColumns,
  genDataModels,
}: BatchInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const result = parseImportedExcel(buffer);
      onChange(result.inputs);

      const messages: string[] = [`已导入 ${result.inputs.length} 条`];
      if (result.unmatchedColumns.length > 0) {
        messages.push(
          `未识别列已暂存：${result.unmatchedColumns.join("、")}`
        );
      }
      if (result.warnings.length > 0) {
        messages.push(`${result.warnings.length} 行存在空值提醒`);
      }
      setImportMessage(messages.join("；"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setImportMessage(`导入失败：${message}`);
    }
  }

  function updateRow(
    id: string,
    updater: (current: TaskInput) => TaskInput
  ) {
    onChange(inputs.map((item) => (item.id === id ? updater(item) : item)));
  }

  function deleteRow(id: string) {
    onChange(inputs.filter((item) => item.id !== id));
  }

  function addRow() {
    onChange([...inputs, { id: generateId(), prompt: "", images: [] }]);
  }

  function handleGenerated(items: TaskInput[], mode: "append" | "replace") {
    const next = mode === "append" ? [...inputs, ...items] : items;
    onChange(next);
    setImportMessage(
      `AI 造数据：${mode === "append" ? "追加" : "生成"} ${items.length} 条`
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => downloadImportTemplate(projectName)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm transition hover:bg-gray-50"
        >
          下载导入模板
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm transition hover:bg-gray-50"
        >
          导入 Excel
        </button>
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm transition hover:bg-gray-50"
        >
          + 新增一行
        </button>
        <GenDataPanel
          projectName={projectName}
          contentMode={contentMode}
          targetColumns={targetColumns}
          modelOptions={genDataModels}
          onGenerated={handleGenerated}
        />
        <span className="ml-auto text-sm text-gray-500">
          共 {inputs.length} 条
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {importMessage && (
        <p className="text-xs text-gray-600">{importMessage}</p>
      )}

      {inputs.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-400">
          暂无数据，请下载模板填写后导入，或点「新增一行」手动添加
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="w-12 px-3 py-2 text-gray-500">#</th>
                <th className="px-3 py-2 text-gray-500">prompt</th>
                <th className="px-3 py-2 text-gray-500">image_url</th>
                <th className="w-16 px-3 py-2 text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {inputs.map((input, index) => (
                <tr key={input.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-400">{index + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      value={input.prompt}
                      onChange={(event) =>
                        updateRow(input.id, (current) => ({
                          ...current,
                          prompt: event.target.value,
                        }))
                      }
                      className="w-full rounded border border-gray-200 px-2 py-1 focus:border-gray-400 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={input.images[0]?.value ?? ""}
                      onChange={(event) =>
                        updateRow(input.id, (current) => ({
                          ...current,
                          images: event.target.value
                            ? [
                                {
                                  id: current.images[0]?.id ?? generateId(),
                                  name:
                                    event.target.value.split("/").pop() ??
                                    "image",
                                  source: "url",
                                  value: event.target.value,
                                },
                              ]
                            : [],
                        }))
                      }
                      placeholder="图片 URL（可选）"
                      className="w-full rounded border border-gray-200 px-2 py-1 focus:border-gray-400 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => deleteRow(input.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
