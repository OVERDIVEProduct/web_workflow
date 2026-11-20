import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { WorkflowNode } from '../types/workflow';

const names: Record<NonNullable<WorkflowNode['type']>, string> = {
  manualTrigger: 'Manual Trigger',
  httpRequest: 'HTTP Request',
  set: 'Set Data',
  if: 'IF',
  output: 'Output',
  stickyNote: '便條紙',
};

export default function WorkflowNodeCard({ data, type, selected }: NodeProps<WorkflowNode>) {
  return (
    <div className={`workflow-node ${selected ? 'selected' : ''}`}>
      {type !== 'manualTrigger' && <Handle type="target" position={Position.Left} />}
      <div className="workflow-node-label">{names[type] ?? 'Node'}</div>
      <div className="workflow-node-caption">{data.label}</div>
      {type !== 'output' && <Handle type="source" position={Position.Right} />}
    </div>
  );
}
