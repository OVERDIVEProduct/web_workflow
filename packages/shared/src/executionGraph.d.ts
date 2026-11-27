interface ExecutionGraph {
  nodes: { id: string; type?: string; data?: { config?: unknown } }[];
  edges: { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }[];
}
export function changedExecutionNodes(previous: ExecutionGraph, current: ExecutionGraph): Set<string>;
