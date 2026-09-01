import type { EvaluationEvidence } from "@/types";

interface EvaluationEvidenceListProps {
  evidence?: EvaluationEvidence[];
  targetNames: ReadonlyMap<string, string>;
  label: string;
}

function sourceLabel(
  evidence: EvaluationEvidence,
  targetNames: ReadonlyMap<string, string>
): string {
  if (evidence.kind === "text_quote") {
    if (evidence.source === "input_prompt") return "输入 prompt";
    if (evidence.source === "expected_answer") return "标准答案";
    const targetName = evidence.targetId
      ? targetNames.get(evidence.targetId) ?? evidence.targetId
      : "未知目标";
    return `${targetName} 输出`;
  }
  if (evidence.source === "input_image") {
    return `输入图片 #${evidence.imageIndex}`;
  }
  const targetName = evidence.targetId
    ? targetNames.get(evidence.targetId) ?? evidence.targetId
    : "未知目标";
  return `${targetName} 输出图片 #${evidence.imageIndex}`;
}

/** 展示服务端校验后的 Judge 原文引用或图片观察；旧记录不补造证据。 */
export function EvaluationEvidenceList({
  evidence,
  targetNames,
  label,
}: EvaluationEvidenceListProps) {
  if (!evidence?.length) {
    return (
      <span
        aria-label={`${label} 未保存结构化证据`}
        title="该记录生成于结构化证据功能上线前，平台不会补造引用。"
        className="mt-1 block whitespace-nowrap text-[10px] font-normal text-slate-600"
      >
        未保存结构化证据
      </span>
    );
  }

  return (
    <details className="group mt-1 min-w-44 font-normal text-slate-600">
      <summary
        aria-label={`查看 ${label} Judge 引用证据（${evidence.length} 条）`}
        className="w-fit cursor-pointer select-none whitespace-nowrap rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 outline-none hover:bg-teal-100 focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        证据 {evidence.length}
      </summary>
      <ol className="mt-1.5 flex max-w-72 list-decimal flex-col gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-6 py-2 text-[11px] leading-4 shadow-sm">
        {evidence.map((item, index) => (
          <li key={`${item.kind}-${item.source}-${index}`}>
            <span className="font-semibold text-slate-700">
              {sourceLabel(item, targetNames)}
            </span>
            {item.kind === "text_quote" ? (
              <>
                <span className="ml-1 text-slate-600">
                  [{item.start}, {item.end})
                </span>
                <q className="mt-0.5 block whitespace-pre-wrap break-words text-slate-600">
                  {item.quote}
                </q>
              </>
            ) : (
              <span className="mt-0.5 block whitespace-pre-wrap break-words text-slate-600">
                {item.observation}
              </span>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}
