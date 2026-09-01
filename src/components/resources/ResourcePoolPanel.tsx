"use client";

import { useDeferredValue, useState } from "react";
import type {
  ResourceCapability,
  ResourceKind,
  ResourceModality,
  TargetConfig,
} from "@/types";
import {
  buildResourceCatalog,
  filterResourceCatalog,
  formatParameterDefault,
  formatParameterRange,
  RESOURCE_CAPABILITIES,
  RESOURCE_CAPABILITY_LABELS,
  type ResourceRole,
} from "@/lib/resourceCatalog";

interface ResourcePoolPanelProps {
  configs: readonly TargetConfig[];
}

const KIND_LABEL: Record<ResourceKind, string> = {
  model: "模型",
  algorithm: "算法",
};

const ROLE_LABEL: Record<ResourceRole, string> = {
  test_target: "被测目标",
  judge: "Judge 候选",
};

const MODALITY_LABEL: Record<ResourceModality, string> = {
  text: "文本",
  image: "图片",
  number: "数值",
  boolean: "布尔值",
};

const STATUS_LABEL: Record<TargetConfig["status"], string> = {
  unverified: "未测试",
  tested_ok: "测试通过",
  tested_fail: "测试失败",
  unsupported: "不支持",
};

const STATUS_CLASS: Record<TargetConfig["status"], string> = {
  unverified:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  tested_ok:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  tested_fail:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
  unsupported:
    "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function ResourcePoolPanel({ configs }: ResourcePoolPanelProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ResourceKind | "all">("all");
  const [role, setRole] = useState<ResourceRole | "all">("all");
  const [capability, setCapability] = useState<
    ResourceCapability | "all"
  >("all");
  const [modality, setModality] = useState<ResourceModality | "all">("all");
  const deferredQuery = useDeferredValue(query);
  const catalog = buildResourceCatalog(configs);
  const visible = filterResourceCatalog(catalog, {
    query: deferredQuery,
    kind,
    role,
    capability,
    modality,
  });
  const modelCount = catalog.filter((entry) => entry.kind === "model").length;
  const algorithmCount = catalog.length - modelCount;
  const judgeCount = catalog.filter((entry) =>
    entry.roles.includes("judge")
  ).length;

  function clearFilters() {
    setQuery("");
    setKind("all");
    setRole("all");
    setCapability("all");
    setModality("all");
  }

  return (
    <section
      aria-label="统一资源池"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-700 dark:bg-slate-900"
    >
      <header className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">
                Resource registry
              </p>
              <span className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] text-slate-200">
                本地确定性目录
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold">模型、算法与 Judge 统一资源池</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
              同一个接入只保存一份定义，再按被测目标或 Judge 角色使用。筛选与浏览不会调用接口、模型或自动启动评价。
            </p>
          </div>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-white/10 p-1 text-center">
            <Metric label="全部" value={catalog.length} />
            <Metric label="模型" value={modelCount} />
            <Metric label="算法" value={algorithmCount} />
            <Metric label="Judge" value={judgeCount} />
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(120px,auto))]">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
            搜索资源
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="名称、ID、角色或能力"
              className="h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <FilterSelect
            label="资源类型"
            value={kind}
            onChange={(value) => setKind(value as ResourceKind | "all")}
            options={[
              ["all", "全部类型"],
              ["model", "模型"],
              ["algorithm", "算法"],
            ]}
          />
          <FilterSelect
            label="使用角色"
            value={role}
            onChange={(value) => setRole(value as ResourceRole | "all")}
            options={[
              ["all", "全部角色"],
              ["test_target", "被测目标"],
              ["judge", "Judge 候选"],
            ]}
          />
          <FilterSelect
            label="能力"
            value={capability}
            onChange={(value) =>
              setCapability(value as ResourceCapability | "all")
            }
            options={[
              ["all", "全部能力"],
              ...RESOURCE_CAPABILITIES.map(
                (item) => [item.id, item.label] as [string, string]
              ),
            ]}
          />
          <FilterSelect
            label="模态"
            value={modality}
            onChange={(value) =>
              setModality(value as ResourceModality | "all")
            }
            options={[
              ["all", "全部模态"],
              ["text", "文本"],
              ["image", "图片"],
              ["number", "数值"],
              ["boolean", "布尔值"],
            ]}
          />
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-slate-600 dark:text-slate-300">
            显示 <strong className="text-slate-900 dark:text-white">{visible.length}</strong> / {catalog.length} 个资源
          </p>
          {(query ||
            kind !== "all" ||
            role !== "all" ||
            capability !== "all" ||
            modality !== "all") && (
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:border-cyan-600 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 dark:border-slate-600 dark:text-slate-200 dark:hover:text-cyan-200"
            >
              清除筛选
            </button>
          )}
        </div>

        {visible.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {visible.map((entry) => (
              <li
                key={entry.id}
                className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-cyan-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-cyan-700"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {entry.name}
                      </h3>
                      <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                        {KIND_LABEL[entry.kind]}
                      </span>
                      {entry.preset && (
                        <span className="rounded border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
                          内置
                        </span>
                      )}
                    </div>
                    <code className="mt-1 block break-all text-[11px] text-slate-500 dark:text-slate-400">
                      {entry.id}
                    </code>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_CLASS[entry.status]}`}
                  >
                    {STATUS_LABEL[entry.status]}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {entry.roles.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800 dark:bg-blue-500/10 dark:text-blue-200"
                    >
                      {ROLE_LABEL[item]}
                    </span>
                  ))}
                  {entry.capabilities.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
                    >
                      {RESOURCE_CAPABILITY_LABELS[item]}
                    </span>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                  <ModalityBlock
                    label="输入模态"
                    values={entry.inputModalities}
                  />
                  <span aria-hidden="true" className="hidden text-slate-400 sm:block">
                    →
                  </span>
                  <ModalityBlock
                    label="输出模态"
                    values={entry.outputModalities}
                  />
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    参数范围
                  </p>
                  {entry.parameters.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {entry.parameters.map((parameter, index) => {
                        const defaultValue = formatParameterDefault(parameter);
                        const range = formatParameterRange(parameter);
                        return (
                          <span
                            key={`${parameter.name}:${index}`}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <strong>{parameter.name || "未命名参数"}</strong>
                            {` · ${parameter.type}`}
                            {parameter.required ? " · 必填" : " · 可选"}
                            {defaultValue !== undefined
                              ? ` · 默认 ${defaultValue}`
                              : ""}
                            {range ? ` · ${range}` : ""}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      未声明参数
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-950/40">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              没有符合当前条件的资源
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              清除筛选，或在下方接口配置中补充资源能力元数据。
            </p>
          </div>
        )}

        <p className="mt-4 rounded-lg border-l-4 border-cyan-700 bg-cyan-50 px-3 py-2 text-xs leading-5 text-cyan-900 dark:bg-cyan-500/10 dark:text-cyan-100">
          资源池不保存第二份接口：上方目录始终由下方 TargetConfig 实时生成。编辑名称、能力、模态或参数后，筛选结果立即同步。
        </p>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-14 rounded-lg px-2 py-2">
      <strong className="block font-mono text-lg tabular-nums">{value}</strong>
      <span className="text-[11px] text-slate-300">{label}</span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function ModalityBlock({
  label,
  values,
}: {
  label: string;
  values: ResourceModality[];
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <p className="mt-0.5 text-sm font-bold text-slate-800 dark:text-slate-100">
        {values.length > 0
          ? values.map((item) => MODALITY_LABEL[item]).join(" + ")
          : "未声明"}
      </p>
    </div>
  );
}
