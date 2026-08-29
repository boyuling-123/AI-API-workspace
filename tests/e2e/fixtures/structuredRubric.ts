export function structuredRubric(name: string, desc: string) {
  return {
    name,
    desc,
    scoreLevels: [
      { score: 0, criteria: `完全不满足${name}要求` },
      { score: 5, criteria: `部分满足${name}要求但有明显缺陷` },
      { score: 10, criteria: `完整满足${name}要求且无明显缺陷` },
    ],
    evidenceRequirements: [`引用输出中与${name}直接相关的内容或缺失点`],
    judgeInstruction: "先定位具体证据，再对照 0/5/10 锚点评分。",
  };
}
