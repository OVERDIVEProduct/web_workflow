import type { Edge, Node } from "@xyflow/react";

export type WorkflowNodeKind =
  | "manualTrigger"
  | "httpRequest"
  | "filter"
  | "set"
  | "sort"
  | "limit"
  | "if"
  | "output"
  | "stickyNote";
export type WorkflowNodeData = {
  label: string;
  config?: Record<string, unknown>;
};
export type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeKind>;
export type WorkflowEdge = Edge;
export type WorkflowDocument = {
  id: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};
