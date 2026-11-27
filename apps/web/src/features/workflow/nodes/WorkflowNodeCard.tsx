import { Handle, Position, type NodeProps } from "@xyflow/react";
import { createContext, useContext } from "react";
import type { WorkflowNode } from "../types/workflow";

const names: Record<NonNullable<WorkflowNode["type"]>, string> = {
  manualTrigger: "Manual Trigger",
  httpRequest: "HTTP Request",
  filter: "Filter",
  set: "Set Data",
  sort: "Sort",
  limit: "Limit",
  if: "IF",
  output: "Output",
  stickyNote: "便條紙",
};

export const StaleExecutionNodes = createContext<ReadonlySet<string>>(
  new Set(),
);

export default function WorkflowNodeCard({
  id,
  data,
  type,
  selected,
}: NodeProps<WorkflowNode>) {
  const stale = useContext(StaleExecutionNodes).has(id);
  return (
    <div className={`workflow-node ${selected ? "selected" : ""}`}>
      {type !== "manualTrigger" && (
        <Handle type="target" position={Position.Left} />
      )}
      <div className="workflow-node-label">{names[type] ?? "Node"}</div>
      <div className="workflow-node-caption">{data.label}</div>
      {stale && <div className="workflow-node-caption">待重新測試</div>}
      {type === "if" ? (
        <>
          <Handle
            type="source"
            id="true"
            position={Position.Right}
            style={{ top: "35%", background: "#21936b" }}
          />
          <Handle
            type="source"
            id="false"
            position={Position.Right}
            style={{ top: "75%", background: "#dc8252" }}
          />
          <div className="if-port-label">True / False</div>
        </>
      ) : (
        type !== "output" && (
          <Handle type="source" id="main" position={Position.Right} />
        )
      )}
    </div>
  );
}
