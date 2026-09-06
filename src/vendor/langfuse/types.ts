// Local structural boundary for the two vendored pure modules.
// No upstream server schema, Decimal, or runtime dependency is required.
export interface TreeNode {
  id: string;
  type: "TRACE" | "AGENT" | "GENERATION" | "TOOL" | "SPAN";
  startTime: Date;
  endTime?: Date | null;
  latency?: number;
  children: TreeNode[];
}

export interface FlatLogItem {
  node: TreeNode;
  treeLines: boolean[];
  isLastSibling: boolean;
}
