import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeChangeset,
  type EdgeChangeset,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import WorkflowNodeCard, {
  StaleExecutionNodes,
} from "../nodes/WorkflowNodeCard";
import NodeConfigEditor, { type ConfigChange } from "./NodeConfigEditor";
import ExecutionPanel, { type WorkflowRun } from "./ExecutionPanel";
import { changedExecutionNodes } from "../../../../../../packages/shared/src/executionGraph.js";
import {
  EditorHeaderActions,
  EditorToolbar,
  EditorToolPanel,
} from "./EditorChrome";
import "./editorChrome.css";
import "./httpRequestEditor.css";
import StickyNoteNode from "../nodes/StickyNoteNode";
import { StickyNoteActionsProvider } from "../nodes/StickyNoteActions";
import {
  readWorkflowInitialization,
  useCollaborativeWorkflow,
  type Graph,
} from "../collaboration/useCollaborativeWorkflow";
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeKind,
  WorkflowDocument,
} from "../types/workflow";

const nodeTypes: NodeTypes = {
  manualTrigger: WorkflowNodeCard,
  httpRequest: WorkflowNodeCard,
  filter: WorkflowNodeCard,
  set: WorkflowNodeCard,
  sort: WorkflowNodeCard,
  limit: WorkflowNodeCard,
  if: WorkflowNodeCard,
  output: WorkflowNodeCard,
  stickyNote: StickyNoteNode,
};
const initialNodes: WorkflowNode[] = [
  {
    id: "trigger-1",
    type: "manualTrigger",
    position: { x: 80, y: 160 },
    data: { label: "Manual Trigger" },
  },
  {
    id: "http-1",
    type: "httpRequest",
    position: { x: 390, y: 160 },
    data: {
      label: "HTTP Request",
      config: {
        method: "GET",
        url: "https://jsonplaceholder.typicode.com/todos",
      },
    },
  },
  {
    id: "output-1",
    type: "output",
    position: { x: 700, y: 160 },
    data: { label: "Output" },
  },
];
const initialEdges: WorkflowEdge[] = [
  { id: "e1", source: "trigger-1", target: "http-1" },
  { id: "e2", source: "http-1", target: "output-1" },
];
const clone = <T,>(value: T): T => structuredClone(value);

function loadDocument(id: string): WorkflowDocument | undefined {
  try {
    const saved = localStorage.getItem(`overdrive:workflow:${id}`);
    if (!saved) return;
    const parsed: unknown = JSON.parse(saved);
    if (
      parsed &&
      typeof parsed === "object" &&
      "nodes" in parsed &&
      "edges" in parsed &&
      Array.isArray(parsed.nodes) &&
      Array.isArray(parsed.edges)
    )
      return parsed as WorkflowDocument;
  } catch {
    /* 使用範例 */
  }
}
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    Boolean(
      target.closest('input, textarea, select, [contenteditable="true"]'),
    ) || target.isContentEditable
  );
}

const API_BASE = import.meta.env.VITE_EXEC_API_URL || "/api";

export default function WorkflowEditor({ workflowId }: { workflowId: string }) {
  const { workflowHeader } = useOutletContext<{
    workflowHeader: HTMLDivElement | null;
  }>();
  const [toolMode, setToolMode] = useState<"select" | "pan">("select");
  const [panelOpen, setPanelOpen] = useState(true);
  const initialGraph = useMemo<Graph>(() => {
    const initialization = readWorkflowInitialization(workflowId);
    if (initialization === "empty") return { nodes: [], edges: [] };
    const saved = loadDocument(workflowId);
    if (saved) return saved;
    return workflowId === "demo" && !initialization
      ? { nodes: initialNodes, edges: initialEdges }
      : { nodes: [], edges: [] };
  }, [workflowId]);
  const [nodes, setNodes] = useNodesState<WorkflowNode>(initialGraph.nodes);
  const [edges, setEdges] = useEdgesState<WorkflowEdge>(initialGraph.edges);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const editorRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<ReactFlowInstance<WorkflowNode, WorkflowEdge>>(null);

  const applyRemote = useCallback(
    (graph: Graph) => {
      // 保留本機選取狀態，避免 A 選取節點會干擾 B 的選取。
      const selectedNodes = new Set(
        nodesRef.current.filter((n) => n.selected).map((n) => n.id),
      );
      const selectedEdges = new Set(
        edgesRef.current.filter((e) => e.selected).map((e) => e.id),
      );
      const nextNodes = graph.nodes.map((n) => ({
        ...n,
        selected: selectedNodes.has(n.id),
      }));
      const nextEdges = graph.edges.map((e) => ({
        ...e,
        selected: selectedEdges.has(e.id),
      }));
      nodesRef.current = nextNodes;
      edgesRef.current = nextEdges;
      setNodes(nextNodes);
      setEdges(nextEdges);
    },
    [setNodes, setEdges],
  );

  const collab = useCollaborativeWorkflow(
    workflowId,
    initialGraph,
    applyRemote,
  );
  const { publish, stopCapture, undo, redo, ready } = collab;
  const clipboard = useRef<Graph | null>(null);
  const pasteCount = useRef(0);
  const [lastSaved, setLastSaved] = useState("");
  // 只控制 HTTP Request 測試設定頁的開關；不更動流程資料。
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [runError, setRunError] = useState("");
  const [canvasError, setCanvasError] = useState("");
  const hasTrigger = nodes.some((node) => node.type === "manualTrigger");
  useEffect(() => {
    if (!hasTrigger) setCanvasError("");
  }, [hasTrigger]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeTargetId, setActiveTargetId] = useState<string>();
  const [executionSession] = useState(() => crypto.randomUUID());
  const [startingRun, setStartingRun] = useState(false);
  const [previousRuns, setPreviousRuns] = useState<WorkflowRun[]>([]);
  const executing =
    startingRun ||
    Boolean(
      activeRunId &&
      (!run || run.status === "queued" || run.status === "running"),
    );
  const staleNodeIds = useMemo(
    () =>
      run?.snapshot
        ? changedExecutionNodes(run.snapshot, { nodes, edges })
        : new Set<string>(),
    [run?.snapshot, nodes, edges],
  );
  const staleCanvasIds = useMemo(() => {
    const seen = new Set<string>();
    const stale = new Set<string>();
    for (const entry of [run, ...previousRuns.slice().reverse()]) {
      if (!entry?.snapshot) continue;
      const changed = changedExecutionNodes(entry.snapshot, { nodes, edges });
      for (const item of entry.nodeRuns) {
        if (seen.has(item.nodeId)) continue;
        seen.add(item.nodeId);
        if (changed.has(item.nodeId)) stale.add(item.nodeId);
      }
    }
    return stale;
  }, [run, previousRuns, nodes, edges]);
  const editingNode = nodes.find((node) => node.id === editingNodeId);
  const isEditingRunTarget = Boolean(
    editingNodeId && activeTargetId === editingNodeId,
  );
  const editingRun = isEditingRunTarget
    ? run
    : [run, ...previousRuns.slice().reverse()].find((entry) =>
        entry?.nodeRuns.some((node) => node.nodeId === editingNodeId),
      );
  const editingStale = Boolean(
    editingNodeId &&
    editingRun?.snapshot &&
    changedExecutionNodes(editingRun.snapshot, { nodes, edges }).has(
      editingNodeId,
    ),
  );

  const updateGraph = useCallback(
    (next: Graph) => {
      nodesRef.current = next.nodes;
      edgesRef.current = next.edges;
      setNodes(next.nodes);
      setEdges(next.edges);
      publish(next);
    },
    [setNodes, setEdges, publish],
  );

  const updateNodeConfig = useCallback(
    (
      id: string,
      changes: ConfigChange[],
      defaults: Record<string, unknown>,
    ) => {
      const current = nodesRef.current;
      const target = current.find((n) => n.id === id);
      if (!target) throw Error("此節點已被刪除。");
      if (!ready) throw Error("協作文件尚未載入。");
      const existing = target.data.config ?? {};
      const config = { ...defaults, ...existing };
      for (const { key, expected, value } of changes) {
        if (
          JSON.stringify(existing[key]) !== JSON.stringify(expected) &&
          JSON.stringify(existing[key]) !== JSON.stringify(value)
        ) {
          throw Error(
            `協作者已變更「${key}」。請重新開啟設定，確認共享值後再修改。`,
          );
        }
        if (value === undefined) delete config[key];
        else
          Object.defineProperty(config, key, {
            value,
            writable: true,
            enumerable: true,
            configurable: true,
          });
      }
      if (JSON.stringify(existing) === JSON.stringify(config)) return config;
      const next = current.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, config } } : n,
      );
      nodesRef.current = next;
      setNodes(next);
      stopCapture();
      publish({ nodes: next, edges: edgesRef.current });
      stopCapture();
      return config;
    },
    [ready, setNodes, publish, stopCapture],
  );

  const startWorkflow = useCallback(
    async (targetNodeId?: string) => {
      if (executing) return;
      setStartingRun(true);
      setRunError("");
      try {
        const triggers = nodesRef.current.filter(
          (n) => n.type === "manualTrigger",
        );
        if (!triggers.length) throw Error("請先新增 Manual Trigger");
        if (triggers.length > 1)
          throw Error("請先修正重複的 Manual Trigger，只保留一個。");
        const graph = {
          id: workflowId,
          nodes: nodesRef.current,
          edges: edgesRef.current,
        };
        const submit = async (confirmWrites: boolean) => {
          const response = await fetch(`${API_BASE}/runs`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              graph,
              triggerId: triggers[0].id,
              targetNodeId,
              sessionKey: executionSession,
              confirmWrites,
            }),
          });
          return { response, data: await response.json() };
        };
        let result = await submit(false);
        if (
          result.response.status === 409 &&
          result.data.code === "CONFIRM_WRITES"
        ) {
          if (!window.confirm(result.data.error)) return;
          result = await submit(true);
        }
        if (!result.response.ok)
          throw Error(
            (result.data.errors || [result.data.error || "啟動失敗"]).join(
              "; ",
            ),
          );
        setRun(null);
        setActiveRunId(result.data.runId);
        setActiveTargetId(targetNodeId);
        setExecutionOpen(!targetNodeId);
      } catch (error) {
        setRunError(error instanceof Error ? error.message : String(error));
        if (!targetNodeId) setExecutionOpen(true);
        else throw error;
      } finally {
        setStartingRun(false);
      }
    },
    [workflowId, executionSession, executing],
  );
  const cancelWorkflow = useCallback(async () => {
    if (!activeRunId) return;
    try {
      const response = await fetch(`${API_BASE}/runs/${activeRunId}/cancel`, {
        method: "POST",
        headers: { "x-execution-session": executionSession },
      });
      if (!response.ok) throw Error("無法取消執行。");
    } catch {
      setRunError("無法取消執行。");
    }
  }, [activeRunId, executionSession]);
  useEffect(() => {
    if (!activeRunId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/runs/${activeRunId}`, {
          signal: controller.signal,
          headers: { "x-execution-session": executionSession },
        });
        if (res.status === 404 && !controller.signal.aborted) {
          setRunError("這次執行已無法取得，請重新執行。");
          setActiveRunId(null);
          return;
        }
        if (!res.ok) throw Error("無法取得後端執行狀態");
        const data = (await res.json()) as WorkflowRun;
        if (controller.signal.aborted) return;
        setRun(data);
        setRunError("");
        if (["success", "failed", "cancelled"].includes(data.status)) {
          setPreviousRuns((history) =>
            [...history.filter((entry) => entry.id !== data.id), data].slice(
              -10,
            ),
          );
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
        setRunError("無法取得後端執行狀態");
      }
      timer = setTimeout(poll, 450);
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [activeRunId, executionSession]);

  const doAction = useCallback(
    (next: Graph) => {
      stopCapture();
      updateGraph(next);
      stopCapture();
    },
    [stopCapture, updateGraph],
  );

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
    [ready, setNodes, publish],
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
    [ready, setEdges, publish],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (
        !ready ||
        !connection.source ||
        !connection.target ||
        connection.source === connection.target
      )
        return;
      const source = nodesRef.current.find((n) => n.id === connection.source);
      const target = nodesRef.current.find((n) => n.id === connection.target);
      if (
        !source ||
        !target ||
        source.type === "output" ||
        source.type === "stickyNote" ||
        target.type === "manualTrigger" ||
        target.type === "stickyNote"
      )
        return;
      const port = connection.sourceHandle || "main";
      if (
        source.type === "if"
          ? !["true", "false"].includes(port)
          : port !== "main"
      )
        return;
      if (
        edgesRef.current.some(
          (e) =>
            e.source === connection.source &&
            e.target === connection.target &&
            (e.sourceHandle || "main") === port,
        )
      )
        return;
      const adjacency = new Map<string, string[]>();
      for (const edge of edgesRef.current) {
        adjacency.set(edge.source, [
          ...(adjacency.get(edge.source) ?? []),
          edge.target,
        ]);
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
      doAction({
        nodes: nodesRef.current,
        edges: addEdge(connection, edgesRef.current),
      });
    },
    [ready, doAction],
  );

  const addNode = useCallback(
    (type: WorkflowNodeKind) => {
      const canvas = editorRef.current;
      const flow = flowRef.current;
      if (!ready || !canvas || !flow) return;
      const current = nodesRef.current;
      if (
        type === "manualTrigger" &&
        current.some((node) => node.type === "manualTrigger")
      ) {
        setCanvasError("每個 Workflow 最多只能有一個 Manual Trigger。");
        return;
      }
      setCanvasError("");
      const bounds = canvas.getBoundingClientRect();
      const center = flow.screenToFlowPosition({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      });
      const topLeft = flow.screenToFlowPosition({
        x: bounds.left,
        y: bounds.top,
      });
      const bottomRight = flow.screenToFlowPosition({
        x: bounds.right,
        y: bounds.bottom,
      });
      const width = type === "stickyNote" ? 230 : 210;
      const height = type === "stickyNote" ? 180 : 74;
      const middle = { x: center.x - width / 2, y: center.y - height / 2 };
      const offsets = [
        [0, 0],
        [0, height + 24],
        [0, -height - 24],
        [width + 24, 0],
        [-width - 24, 0],
      ];
      const available = offsets
        .map(([x, y]) => ({ x: middle.x + x, y: middle.y + y }))
        .find(
          (position) =>
            position.x >= topLeft.x &&
            position.y >= topLeft.y &&
            position.x + width <= bottomRight.x &&
            position.y + height <= bottomRight.y &&
            !flow.getIntersectingNodes(
              { ...position, width, height },
              true,
              current,
            ).length,
        );
      const position =
        available ??
        (flow.getIntersectingNodes({ ...middle, width, height }, true, current)
          .length
          ? { x: middle.x + 18, y: middle.y + 18 }
          : middle);
      const next: WorkflowNode[] = [
        ...current.map((node) =>
          node.selected ? { ...node, selected: false } : node,
        ),
        {
          id: `${type}-${crypto.randomUUID()}`,
          type,
          position,
          selected: true,
          data: {
            label:
              type === "stickyNote"
                ? "雙擊編輯便條紙"
                : type === "httpRequest"
                  ? "請在後續設定欄位"
                  : "新節點",
          },
        },
      ];
      doAction({
        nodes: next,
        edges: edgesRef.current.map((edge) =>
          edge.selected ? { ...edge, selected: false } : edge,
        ),
      });
    },
    [ready, doAction],
  );

  const commitStickyNote = useCallback(
    (id: string, text: string) => {
      if (!ready) return;
      const current = nodesRef.current;
      const target = current.find(
        (n) => n.id === id && n.type === "stickyNote",
      );
      if (!target || target.data.label === text) return;
      const next = current.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label: text } } : n,
      );
      doAction({ nodes: next, edges: edgesRef.current });
    },
    [ready, doAction],
  );
  const stickyActions = useMemo(
    () => ({ commitText: commitStickyNote }),
    [commitStickyNote],
  );

  const save = useCallback(() => {
    localStorage.setItem(
      `overdrive:workflow:${workflowId}`,
      JSON.stringify({
        id: workflowId,
        nodes: nodesRef.current,
        edges: edgesRef.current,
      }),
    );
    setLastSaved(new Date().toLocaleTimeString());
  }, [workflowId]);

  const selectAll = useCallback(() => {
    const next = nodesRef.current.map((n) => ({ ...n, selected: true }));
    nodesRef.current = next;
    setNodes(next);
  }, [setNodes]);
  const clearSelection = useCallback(() => {
    const nextNodes = nodesRef.current.map((n) => ({ ...n, selected: false }));
    const nextEdges = edgesRef.current.map((e) => ({ ...e, selected: false }));
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [setNodes, setEdges]);
  const deleteSelected = useCallback(() => {
    if (!ready) return;
    const nodeIds = new Set(
      nodesRef.current.filter((n) => n.selected).map((n) => n.id),
    );
    if (!nodeIds.size && !edgesRef.current.some((e) => e.selected)) return;
    setCanvasError("");
    doAction({
      nodes: nodesRef.current.filter((n) => !nodeIds.has(n.id)),
      edges: edgesRef.current.filter(
        (e) => !e.selected && !nodeIds.has(e.source) && !nodeIds.has(e.target),
      ),
    });
  }, [ready, doAction]);

  const copySelected = useCallback(() => {
    const selectedNodes = nodesRef.current.filter((n) => n.selected);
    if (!selectedNodes.length) return;
    const ids = new Set(selectedNodes.map((n) => n.id));
    clipboard.current = {
      nodes: clone(selectedNodes),
      edges: clone(
        edgesRef.current.filter((e) => ids.has(e.source) && ids.has(e.target)),
      ),
    };
    pasteCount.current = 0;
  }, []);
  const paste = useCallback(() => {
    if (!ready || !clipboard.current?.nodes.length) return;
    const copiedTriggers = clipboard.current.nodes.filter(
      (node) => node.type === "manualTrigger",
    ).length;
    if (
      copiedTriggers &&
      nodesRef.current.filter((node) => node.type === "manualTrigger").length +
        copiedTriggers >
        1
    ) {
      setCanvasError("無法貼上。每個 Workflow 最多只能有一個 Manual Trigger。");
      return;
    }
    setCanvasError("");
    pasteCount.current++;
    const offset = 48 * pasteCount.current;
    const idMap = new Map<string, string>();
    const pastedNodes: WorkflowNode[] = clipboard.current.nodes.map((node) => {
      const id = `${node.type ?? "node"}-${crypto.randomUUID()}`;
      idMap.set(node.id, id);
      return {
        ...clone(node),
        id,
        selected: true,
        position: { x: node.position.x + offset, y: node.position.y + offset },
      };
    });
    const pastedEdges = clipboard.current.edges.map((edge) => ({
      ...clone(edge),
      id: `edge-${crypto.randomUUID()}`,
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
      selected: false,
    }));
    doAction({
      nodes: [
        ...nodesRef.current.map((n) => ({ ...n, selected: false })),
        ...pastedNodes,
      ],
      edges: [
        ...edgesRef.current.map((e) => ({ ...e, selected: false })),
        ...pastedEdges,
      ],
    });
  }, [ready, doAction]);

  const onNodeDragStart = useCallback(() => stopCapture(), [stopCapture]);
  const onNodeDragStop = useCallback(() => stopCapture(), [stopCapture]);

  // 使用 React Flow 畫布根元素範圍，避免攔截其他頁面/表單快捷鍵。
  const [editorFocused, setEditorFocused] = useState(false);
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!ready || isTypingTarget(event.target)) return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (modifier && key === "s") {
        event.preventDefault();
        save();
        return;
      }
      if (modifier && key === "a") {
        event.preventDefault();
        selectAll();
        return;
      }
      if (modifier && key === "c") {
        event.preventDefault();
        copySelected();
        return;
      }
      if (modifier && key === "v") {
        event.preventDefault();
        paste();
        return;
      }
      if (modifier && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (modifier && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (!modifier && (key === "delete" || key === "backspace")) {
        event.preventDefault();
        deleteSelected();
        return;
      }
      if (!modifier && key === "escape") {
        clearSelection();
      }
    },
    [
      ready,
      save,
      selectAll,
      copySelected,
      paste,
      redo,
      undo,
      deleteSelected,
      clearSelection,
    ],
  );

  return (
    <StaleExecutionNodes.Provider value={staleCanvasIds}>
      <StickyNoteActionsProvider actions={stickyActions}>
        <div className="workflow-editor-layout">
          {workflowHeader &&
            createPortal(
              <>
                <EditorHeaderActions
                  connected={collab.connected}
                  ready={ready}
                  onlineCount={collab.onlineCount}
                  canUndo={collab.canUndo}
                  canRedo={collab.canRedo}
                  onUndo={undo}
                  onRedo={redo}
                  onSave={save}
                  lastSaved={lastSaved}
                />
                {executing ? (
                  <button
                    type="button"
                    className="editor-run-cancel"
                    onClick={() => void cancelWorkflow()}
                  >
                    Stop
                  </button>
                ) : run && !executionOpen ? (
                  <button
                    type="button"
                    className="editor-run-history"
                    onClick={() => setExecutionOpen(true)}
                  >
                    View execution
                  </button>
                ) : null}
                <button
                  type="button"
                  className="primary-button editor-run-button"
                  disabled={!ready || executing}
                  onClick={() => void startWorkflow()}
                >
                  Execute Workflow
                </button>
              </>,
              workflowHeader,
            )}
          <div
            className="editor-wrap"
            ref={editorRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onFocus={() => setEditorFocused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget))
                setEditorFocused(false);
            }}
            onPointerDown={() =>
              editorRef.current?.focus({ preventScroll: true })
            }
          >
            <ReactFlow<WorkflowNode, WorkflowEdge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onInit={(instance) => {
                flowRef.current = instance;
              }}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDoubleClick={(_, node) => {
                if (node.type !== "stickyNote") setEditingNodeId(node.id);
              }}
              onNodeDragStart={onNodeDragStart}
              onNodeDragStop={onNodeDragStop}
              deleteKeyCode={null}
              nodesDraggable={ready}
              nodesConnectable={ready}
              elementsSelectable={ready}
              panOnDrag={toolMode === "pan"}
              fitView
            >
              <Background gap={18} size={1} color="#d8dfec" />
              <Controls />
              <MiniMap zoomable pannable />
              <Panel position="bottom-center" className="flow-toolbar">
                <span style={{ fontSize: 11, color: "#63738a" }}>
                  {editorFocused
                    ? "編輯器快捷鍵已啟用 · "
                    : "點擊畫布以啟用快捷鍵 · "}
                  Delete 刪除 · Ctrl+A 全選 · Ctrl+C/V 複製貼上 · Ctrl+Z 復原 ·
                  Ctrl+Y 重做 · Ctrl+S 備份 · Esc 取消選取
                  {lastSaved ? ` · 本機備份 ${lastSaved}` : ""}
                </span>
              </Panel>
            </ReactFlow>
            {editingNode && (
              <NodeConfigEditor
                key={editingNode.id}
                node={editingNode}
                nodeRuns={
                  editingRun?.nodeRuns.filter(
                    (n) => n.nodeId === editingNode.id,
                  ) || []
                }
                allNodeRuns={
                  run?.nodeRuns.filter(
                    (n) =>
                      n.status === "success" && !staleNodeIds.has(n.nodeId),
                  ) || []
                }
                edges={edges}
                nodeLabels={Object.fromEntries(
                  nodes.map((n) => [n.id, n.data.label]),
                )}
                apiBase={API_BASE}
                workflowId={workflowId}
                onChange={(changes, defaults) =>
                  updateNodeConfig(editingNode.id, changes, defaults)
                }
                onClose={() => setEditingNodeId(null)}
                onExecuteToHere={() => startWorkflow(editingNode.id)}
                onCancelExecution={() => void cancelWorkflow()}
                executionBusy={executing}
                targetStatus={isEditingRunTarget ? run?.status : undefined}
                executionError={
                  isEditingRunTarget ? runError || run?.error || "" : ""
                }
                stale={editingStale}
              />
            )}
            {executionOpen && (
              <ExecutionPanel
                run={run}
                error={runError}
                onClose={() => setExecutionOpen(false)}
                onCancel={() => void cancelWorkflow()}
                staleNodeIds={staleNodeIds}
              />
            )}
            <EditorToolbar
              mode={toolMode}
              onMode={setToolMode}
              ready={ready}
              onAdd={addNode}
              panelOpen={panelOpen}
              onTogglePanel={() => setPanelOpen((open) => !open)}
            />
          </div>
          {canvasError && (
            <div className="editor-canvas-error" role="alert">
              {canvasError}
            </div>
          )}
          {panelOpen && <EditorToolPanel ready={ready} onAdd={addNode} />}
        </div>
      </StickyNoteActionsProvider>
    </StaleExecutionNodes.Provider>
  );
}
