import { useState } from "react";
import NodeDataViewer, { type ViewerItem } from "./NodeDataViewer";

import type { WorkflowEdge, WorkflowNode } from "../types/workflow";

type NodeRun = {
  id: string;
  nodeId: string;
  status: string;
  error?: string;
  inputItems: ViewerItem[];
  outputItemsByPort: Record<string, ViewerItem[]>;
  durationMs?: number;
  reused?: boolean;
};
export type WorkflowRun = {
  id: string;
  status: string;
  error?: string | null;
  targetNodeId?: string;
  snapshot?: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  nodeRuns: NodeRun[];
};
export default function ExecutionPanel({
  run,
  error,
  onClose,
  onCancel,
  staleNodeIds,
}: {
  run: WorkflowRun | null;
  error: string;
  onClose: () => void;
  onCancel: () => void;
  staleNodeIds: ReadonlySet<string>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const current =
    run?.nodeRuns.find((n) => n.id === selected) || run?.nodeRuns.at(-1);
  return (
    <div className="execution-panel">
      <header>
        <strong>Workflow Execution</strong>
        <span>{run?.status || "啟動中"}</span>
        <button onClick={onCancel} disabled={!run || run.status !== "running"}>
          Stop
        </button>
        <button onClick={onClose}>關閉</button>
      </header>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {run?.error && <p style={{ color: "crimson" }}>{run.error}</p>}
      <div className="execution-columns">
        <aside>
          {run?.nodeRuns.map((n, i) => (
            <button
              key={n.id}
              className={n.id === current?.id ? "active" : ""}
              onClick={() => setSelected(n.id)}
            >
              {i + 1}. {n.nodeId} · {n.status}
              {n.reused ? " · 沿用上游結果" : ""}
              {staleNodeIds.has(n.nodeId) ? " · 待重新測試" : ""}
            </button>
          ))}
        </aside>
        <div className="execution-data">
          {current ? (
            <div key={current.id}>
              <b>{current.nodeId}</b>
              <p>
                {current.status} · {current.durationMs ?? "—"} ms
              </p>
              {current.error && <p>{current.error}</p>}
              <b>Input</b>
              <NodeDataViewer
                items={current.inputItems}
                emptyText="尚無輸入資料"
              />
              <b>Output</b>
              {Object.entries(current.outputItemsByPort).map(
                ([port, items]) => (
                  <section key={port}>
                    <strong>{port}</strong>
                    <NodeDataViewer items={items} emptyText="尚無輸出資料" />
                  </section>
                ),
              )}
              {Object.keys(current.outputItemsByPort).length === 0 && (
                <p>目前沒有輸出資料。</p>
              )}
            </div>
          ) : (
            <p>尚無節點執行紀錄</p>
          )}
        </div>
      </div>
      {run?.status === "success" &&
        run.targetNodeId &&
        !run.nodeRuns.some((node) => node.nodeId === run.targetNodeId) && (
          <p role="status">
            此次沒有資料抵達目標節點。請檢查上游條件與分支輸出。
          </p>
        )}
    </div>
  );
}
