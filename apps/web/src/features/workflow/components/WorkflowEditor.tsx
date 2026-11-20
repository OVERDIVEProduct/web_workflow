import { useCallback, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, Panel, addEdge,
  useNodesState, useEdgesState,
  type Connection,
  type NodeChangeset,
  type EdgeChangeset,
  type NodeTypes,
} from '@xyflow/react';
import WorkflowNodeCard from '../nodes/WorkflowNodeCard';
import StickyNoteNode from '../nodes/StickyNoteNode';
import { StickyNoteActionsProvider } from '../nodes/StickyNoteActions';
import { useCollaborativeWorkflow, type Graph } from '../collaboration/useCollaborativeWorkflow';
import type { WorkflowNode, WorkflowEdge, WorkflowNodeKind, WorkflowDocument } from '../types/workflow';

const nodeTypes: NodeTypes = {
  manualTrigger: WorkflowNodeCard,
  httpRequest: WorkflowNodeCard,
  set: WorkflowNodeCard,
  if: WorkflowNodeCard,
  output: WorkflowNodeCard,
  stickyNote: StickyNoteNode,
};
const initialNodes: WorkflowNode[] = [
  { id: 'trigger-1', type: 'manualTrigger', position: { x: 80, y: 160 }, data: { label: '點擊執行（尚未接後端）' } },
  { id: 'http-1', type: 'httpRequest', position: { x: 390, y: 160 }, data: { label: 'GET https://example.com', config: { method: 'GET', url: 'https://example.com' } } },
  { id: 'output-1', type: 'output', position: { x: 700, y: 160 }, data: { label: '查看輸出（示範）' } },
];
const initialEdges: WorkflowEdge[] = [
  { id: 'e1', source: 'trigger-1', target: 'http-1' },
  { id: 'e2', source: 'http-1', target: 'output-1' },
];
const choices: { type: WorkflowNodeKind; label: string }[] = [
  { type: 'manualTrigger', label: 'Trigger' },
  { type: 'httpRequest', label: 'HTTP' },
  { type: 'set', label: 'Set' },
  { type: 'if', label: 'IF' },
  { type: 'output', label: 'Output' },
  { type: 'stickyNote', label: '便條紙' },
];
const clone = <T,>(value: T): T => structuredClone(value);

function loadDocument(id: string): WorkflowDocument | undefined {
  try {
    const saved = localStorage.getItem(`overdrive:workflow:${id}`);
    if (!saved) return;
    const parsed: unknown = JSON.parse(saved);
    if (parsed && typeof parsed === 'object' && 'nodes' in parsed && 'edges' in parsed &&
      Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) return parsed as WorkflowDocument;
  } catch { /* 使用範例 */ }
}
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]')) || target.isContentEditable;
}

export default function WorkflowEditor({ workflowId }: { workflowId: string }) {
  const saved = useMemo(() => loadDocument(workflowId), [workflowId]);
  const [nodes, setNodes] = useNodesState<WorkflowNode>(saved?.nodes ?? initialNodes);
  const [edges, setEdges] = useEdgesState<WorkflowEdge>(saved?.edges ?? initialEdges);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const applyRemote = useCallback((graph: Graph) => {
    // 保留本機選取狀態，避免 A 選取節點會干擾 B 的選取。
    const selectedNodes = new Set(nodesRef.current.filter((n) => n.selected).map((n) => n.id));
    const selectedEdges = new Set(edgesRef.current.filter((e) => e.selected).map((e) => e.id));
    const nextNodes = graph.nodes.map((n) => ({ ...n, selected: selectedNodes.has(n.id) }));
    const nextEdges = graph.edges.map((e) => ({ ...e, selected: selectedEdges.has(e.id) }));
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [setNodes, setEdges]);

  const collab = useCollaborativeWorkflow(workflowId, saved ?? { nodes: initialNodes, edges: initialEdges }, applyRemote);
  const { publish, stopCapture, undo, redo, ready } = collab;
  const clipboard = useRef<Graph | null>(null);
  const pasteCount = useRef(0);
  const [lastSaved, setLastSaved] = useState('');

  const updateGraph = useCallback((next: Graph) => {
    nodesRef.current = next.nodes;
    edgesRef.current = next.edges;
    setNodes(next.nodes);
    setEdges(next.edges);
    publish(next);
  }, [setNodes, setEdges, publish]);

  const doAction = useCallback((next: Graph) => {
    stopCapture();
    updateGraph(next);
    stopCapture();
  }, [stopCapture, updateGraph]);


  const onNodesChange = useCallback(
    (changes: NodeChangeset<WorkflowNode>) => {
      if (!ready) return;

      const nextNodes = changes.applyTo(nodesRef.current);

      nodesRef.current = nextNodes;
      setNodes(nextNodes);

      publish({
        nodes: nextNodes,
        edges: edgesRef.current,
      });
    },
    [ready, setNodes, publish]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChangeset<WorkflowEdge>) => {
      if (!ready) return;

      const nextEdges = changes.applyTo(edgesRef.current);

      edgesRef.current = nextEdges;
      setEdges(nextEdges);

      publish({
        nodes: nodesRef.current,
        edges: nextEdges,
      });
    },
    [ready, setEdges, publish]
  );

  const onConnect = useCallback((connection: Connection) => {
    if (!ready || !connection.source || !connection.target || connection.source === connection.target) return;
    const adjacency = new Map<string, string[]>();
    for (const edge of edgesRef.current) {
      adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
    }
    const pending = [connection.target];
    const visited = new Set<string>();
    while (pending.length) {
      const current = pending.pop()!;
      if (current === connection.source) return;
      if (visited.has(current)) continue;
      visited.add(current);
      pending.push(...(adjacency.get(current) ?? []));
    }
    doAction({ nodes: nodesRef.current, edges: addEdge(connection, edgesRef.current) });
  }, [ready, doAction]);

  const addNode = useCallback((type: WorkflowNodeKind) => {
    if (!ready) return;
    const current = nodesRef.current;
    const next: WorkflowNode[] = [...current, {
      id: `${type}-${crypto.randomUUID()}`,
      type,
      position: { x: 170 + (current.length % 4) * 80, y: 340 + (current.length % 3) * 45 },
      data: { label: type === 'stickyNote' ? '雙擊編輯便條紙' : type === 'httpRequest' ? '請在後續設定欄位' : '新節點' },
    }];
    doAction({ nodes: next, edges: edgesRef.current });
  }, [ready, doAction]);

  const commitStickyNote = useCallback((id: string, text: string) => {
    if (!ready) return;
    const current = nodesRef.current;
    const target = current.find((n) => n.id === id && n.type === 'stickyNote');
    if (!target || target.data.label === text) return;
    const next = current.map((n) => n.id === id ? { ...n, data: { ...n.data, label: text } } : n);
    doAction({ nodes: next, edges: edgesRef.current });
  }, [ready, doAction]);
  const stickyActions = useMemo(() => ({ commitText: commitStickyNote }), [commitStickyNote]);

  const save = useCallback(() => {
    localStorage.setItem(`overdrive:workflow:${workflowId}`, JSON.stringify({
      id: workflowId, nodes: nodesRef.current, edges: edgesRef.current,
    }));
    setLastSaved(new Date().toLocaleTimeString());
  }, [workflowId]);

  const selectAll = useCallback(() => {
    const next = nodesRef.current.map((n) => ({ ...n, selected: true }));
    nodesRef.current = next; setNodes(next);
  }, [setNodes]);
  const clearSelection = useCallback(() => {
    const nextNodes = nodesRef.current.map((n) => ({ ...n, selected: false }));
    const nextEdges = edgesRef.current.map((e) => ({ ...e, selected: false }));
    nodesRef.current = nextNodes; edgesRef.current = nextEdges;
    setNodes(nextNodes); setEdges(nextEdges);
  }, [setNodes, setEdges]);
  const deleteSelected = useCallback(() => {
    if (!ready) return;
    const nodeIds = new Set(nodesRef.current.filter((n) => n.selected).map((n) => n.id));
    if (!nodeIds.size && !edgesRef.current.some((e) => e.selected)) return;
    doAction({
      nodes: nodesRef.current.filter((n) => !nodeIds.has(n.id)),
      edges: edgesRef.current.filter((e) => !e.selected && !nodeIds.has(e.source) && !nodeIds.has(e.target)),
    });
  }, [ready, doAction]);

  const copySelected = useCallback(() => {
    const selectedNodes = nodesRef.current.filter((n) => n.selected);
    if (!selectedNodes.length) return;
    const ids = new Set(selectedNodes.map((n) => n.id));
    clipboard.current = {
      nodes: clone(selectedNodes),
      edges: clone(edgesRef.current.filter((e) => ids.has(e.source) && ids.has(e.target))),
    };
    pasteCount.current = 0;
  }, []);
  const paste = useCallback(() => {
    if (!ready || !clipboard.current?.nodes.length) return;
    pasteCount.current++;
    const offset = 48 * pasteCount.current;
    const idMap = new Map<string, string>();
    const pastedNodes: WorkflowNode[] = clipboard.current.nodes.map((node) => {
      const id = `${node.type ?? 'node'}-${crypto.randomUUID()}`;
      idMap.set(node.id, id);
      return { ...clone(node), id, selected: true, position: { x: node.position.x + offset, y: node.position.y + offset } };
    });
    const pastedEdges = clipboard.current.edges.map((edge) => ({
      ...clone(edge), id: `edge-${crypto.randomUUID()}`,
      source: idMap.get(edge.source)!, target: idMap.get(edge.target)!, selected: false,
    }));
    doAction({
      nodes: [...nodesRef.current.map((n) => ({ ...n, selected: false })), ...pastedNodes],
      edges: [...edgesRef.current.map((e) => ({ ...e, selected: false })), ...pastedEdges],
    });
  }, [ready, doAction]);

  const onNodeDragStart = useCallback(() => stopCapture(), [stopCapture]);
  const onNodeDragStop = useCallback(() => stopCapture(), [stopCapture]);

  // 使用 React Flow 畫布根元素範圍，避免攔截其他頁面/表單快捷鍵。
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorFocused, setEditorFocused] = useState(false);
  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!ready || isTypingTarget(event.target)) return;
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (modifier && key === 's') { event.preventDefault(); save(); return; }
    if (modifier && key === 'a') { event.preventDefault(); selectAll(); return; }
    if (modifier && key === 'c') { event.preventDefault(); copySelected(); return; }
    if (modifier && key === 'v') { event.preventDefault(); paste(); return; }
    if (modifier && key === 'y') { event.preventDefault(); redo(); return; }
    if (modifier && key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); return; }
    if (!modifier && (key === 'delete' || key === 'backspace')) { event.preventDefault(); deleteSelected(); return; }
    if (!modifier && key === 'escape') { clearSelection(); }
  }, [ready, save, selectAll, copySelected, paste, redo, undo, deleteSelected, clearSelection]);

  return (
    <StickyNoteActionsProvider actions={stickyActions}>
      <div
        className="editor-wrap"
        ref={editorRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => setEditorFocused(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setEditorFocused(false); }}
        onPointerDown={() => editorRef.current?.focus({ preventScroll: true })}
      >
        <ReactFlow<WorkflowNode, WorkflowEdge>
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={onNodeDragStart} onNodeDragStop={onNodeDragStop}
          deleteKeyCode={null}
          nodesDraggable={ready} nodesConnectable={ready} elementsSelectable={ready}
          fitView
        >
          <Background gap={18} size={1} color="#d8dfec" />
          <Controls />
          <MiniMap zoomable pannable />
          <Panel position="top-left" className="flow-toolbar">
            <strong>新增節點</strong>
            {choices.map(({ type, label }) => (
              <button key={type} type="button" disabled={!ready} onClick={() => addNode(type)}>{label}</button>
            ))}
          </Panel>
          <Panel position="top-right" className="flow-toolbar">
            <span style={{ fontSize: 12, marginRight: 8 }}>
              {!ready ? '● 等待首次同步' : collab.connected ? `● 已連線 · ${collab.onlineCount} 人在線` : '● 已斷線（更新待重新連線）'}
            </span>
            <button type="button" disabled={!ready || !collab.canUndo} onClick={undo} title="Ctrl + Z">復原</button>
            <button type="button" disabled={!ready || !collab.canRedo} onClick={redo} title="Ctrl + Y">重做</button>
            <button type="button" disabled={!ready} className="primary-button" onClick={save} title="Ctrl + S">備份至本機</button>
          </Panel>
          <Panel position="bottom-center" className="flow-toolbar">
            <span style={{ fontSize: 11, color: '#63738a' }}>
              {editorFocused ? '編輯器快捷鍵已啟用 · ' : '點擊畫布以啟用快捷鍵 · '}
              Delete 刪除 · Ctrl+A 全選 · Ctrl+C/V 複製貼上 · Ctrl+Z 復原 · Ctrl+Y 重做 · Ctrl+S 備份 · Esc 取消選取
              {lastSaved ? ` · 本機備份 ${lastSaved}` : ''}
            </span>
          </Panel>
        </ReactFlow>
      </div>
    </StickyNoteActionsProvider>
  );
}
