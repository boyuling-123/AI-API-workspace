"use client";

import type { TargetConfig, ParamDef, TaskInput } from "@/types";

interface AlgoParamsInputProps {
  /** 当前选中的、需要额外入参的算法目标。 */
  algoConfigs: TargetConfig[];
  /** 当前编辑的输入（单条模式），extraFields 持有算法参数值。 */
  input: TaskInput;
  onChange: (updater: (current: TaskInput) => TaskInput) => void;
}

/**
 * 图片数量等参数联动区：选中目标后，按其 ParamDef 自动生成需要手填的设置项表单，
 * 值写入 input.extraFields，运行时由 runService 组装为请求参数。
 * 'prompt'（走主输入框）和 'image'（走主图片输入区）不在此渲染，
 * 因此只多一个 image 参数的多模态模型（Kimi/Qwen）不会显示此面板。
 */
export function AlgoParamsInput({
  algoConfigs,
  input,
  onChange,
}: AlgoParamsInputProps) {
  const paramsToRender = collectExtraParams(algoConfigs);
  if (paramsToRender.length === 0) return null;

  function setField(name: string, value: unknown) {
    onChange((current) => ({
      ...current,
      extraFields: { ...(current.extraFields ?? {}), [name]: value },
    }));
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-indigo-700">参数填写</h3>
        <span className="text-xs text-gray-400">
          按下方各参数旁的灰字说明填写
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {paramsToRender.map((param) => (
          <ParamField
            key={param.name}
            param={param}
            value={input.extraFields?.[param.name]}
            onChange={(value) => setField(param.name, value)}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * 汇总所有选中目标里"需要用户手填的设置项"，按名去重（同名取首个定义）。
 * 跳过 prompt（走主输入框）和 image（走主图片输入区）——
 * 这样 Kimi/Qwen 这类只多一个 image 参数的多模态模型不会弹出此面板，
 * 而生图模型的 num_images 等数量/设置项仍会保留并展示。
 */
function collectExtraParams(algoConfigs: TargetConfig[]): ParamDef[] {
  const byName = new Map<string, ParamDef>();
  for (const config of algoConfigs) {
    for (const param of config.inputParams ?? []) {
      if (param.name === "prompt") continue;
      if (param.type === "image") continue;
      if (!byName.has(param.name)) byName.set(param.name, param);
    }
  }
  return Array.from(byName.values());
}

function ParamField({
  param,
  value,
  onChange,
}: {
  param: ParamDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = (
    <span className="text-xs font-medium text-gray-600">
      {param.name}
      {param.required ? (
        <span className="text-red-500" title="必填">
          {" "}
          *
        </span>
      ) : (
        <span className="ml-1 font-normal text-gray-400">(选填)</span>
      )}
      {param.desc && (
        <span className="ml-1 font-normal text-gray-400">（{param.desc}）</span>
      )}
    </span>
  );

  if (param.type === "boolean") {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
    );
  }

  const inputType = param.type === "number" ? "number" : "text";
  const displayValue =
    value === undefined || value === null ? "" : String(value);
  const placeholder =
    param.defaultValue !== undefined ? `默认 ${String(param.defaultValue)}` : "";

  return (
    <label className="flex flex-col gap-1">
      {label}
      <input
        type={inputType}
        value={displayValue}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(
            param.type === "number"
              ? e.target.value === ""
                ? undefined
                : Number(e.target.value)
              : e.target.value
          )
        }
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  );
}
