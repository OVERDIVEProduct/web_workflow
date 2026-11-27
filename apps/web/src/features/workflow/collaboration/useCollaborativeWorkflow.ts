import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { WorkflowEdge, WorkflowNode } from "../types/workflow";

export type Graph = { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
type NodeEntry = Y.Map<unknown>;

const initializationKey = (workflowId: string) =>
  `overdrive:workflow-initialized:${workflowId}`;

export function readWorkflowInitialization(workflowId: string) {
  try {
    return localStorage.getItem(initializationKey(workflowId));
  } catch {
    return null;
  }
}

function rememberWorkflowInitialization(workflowId: string, graph: Graph) {
  try {
    const value =
      graph.nodes.length || graph.edges.length ? "initialized" : "empty";
    const key = initializationKey(workflowId);
    if (localStorage.getItem(key) !== value) localStorage.setItem(key, value);
  } catch {
    // The collaboration document still tracks initialization if browser storage is unavailable.
  }
}

type Session = {
  doc: Y.Doc;
  provider: WebsocketProvider;
  nodes: Y.Map<NodeEntry>;
  edges: Y.Map<string>;
  undoManager: Y.UndoManager;
  localOrigin: object;
  synced: boolean;
};

// selected / dragging 等互動狀態只存在各自瀏覽器，不寫進共用文件。
function stripNode(node: WorkflowNode) {
  const {
    selected: _selected,
    dragging: _dragging,
    position,
    data,
    ...base
  } = node;
  const { label, ...restData } = data;
  void _selected;
  void _dragging;
  return {
    base: JSON.stringify({ ...base, data: restData }),
    x: position.x,
    y: position.y,
    label,
  };
}
function stripEdge(edge: WorkflowEdge) {
  const { selected: _selected, ...shared } = edge;
  void _selected;
  return JSON.stringify(shared);
}
function writeNode(record: NodeEntry, node: WorkflowNode) {
  const next = stripNode(node);
  if (record.get("base") !== next.base) record.set("base", next.base);
  if (record.get("x") !== next.x) record.set("x", next.x);
  if (record.get("y") !== next.y) record.set("y", next.y);
  if (record.get("label") !== next.label) record.set("label", next.label);
}
function readGraph(session: Session): Graph {
  const nodes: WorkflowNode[] = [];
  session.nodes.forEach((record, id) => {
    const base = JSON.parse(String(record.get("base") ?? "{}")) as WorkflowNode;
    nodes.push({
      ...base,
      id,
      position: {
        x: Number(record.get("x") ?? 0),
        y: Number(record.get("y") ?? 0),
      },
      data: { ...base.data, label: String(record.get("label") ?? "") },
    });
  });
  const edges: WorkflowEdge[] = [];
  session.edges.forEach((value) =>
    edges.push(JSON.parse(value) as WorkflowEdge),
  );
  return { nodes, edges };
}

export function useCollaborativeWorkflow(
  workflowId: string,
  initial: Graph,
  onRemoteGraph: (graph: Graph) => void,
) {
  const sessionRef = useRef<Session | null>(null);
  const initialRef = useRef(initial);
  const callbackRef = useRef(onRemoteGraph);
  callbackRef.current = onRemoteGraph;
  initialRef.current = initial;
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [, forceRefresh] = useState(0);

  useEffect(() => {
    const doc = new Y.Doc();
    const nodes = doc.getMap<NodeEntry>("nodes");
    const edges = doc.getMap<string>("edges");
    const metadata = doc.getMap<boolean>("workflowMetadata");
    const localOrigin = {};
    const undoManager = new Y.UndoManager([nodes, edges], {
      trackedOrigins: new Set([localOrigin]),
      // 所有一次性操作會在前後 stopCapturing，拖曳則合併為一筆。
      captureTimeout: 1_000_000,
    });
    const serverUrl =
      import.meta.env.VITE_COLLAB_WS_URL || "ws://localhost:1234";
    const provider = new WebsocketProvider(
      serverUrl,
      `overdrive-${workflowId}`,
      doc,
    );
    const onDocUpdate = (update: Uint8Array, origin: unknown) => {
      console.log("[Yjs] 文件更新", {
        bytes: update.byteLength,
        origin,
        room: `overdrive-${workflowId}`,
        connected: provider.wsconnected,
        synced: provider.synced,
      });
    };

    doc.on("update", onDocUpdate);
    const session: Session = {
      doc,
      nodes,
      edges,
      provider,
      undoManager,
      localOrigin,
      synced: false,
    };
    sessionRef.current = session;
    setReady(false);
    setConnected(false);

    const updatePresence = () =>
      setOnlineCount(provider.awareness.getStates().size);
    provider.awareness.setLocalStateField("user", {
      name: `訪客-${String(doc.clientID).slice(-4)}`,
    });
    provider.awareness.on("change", updatePresence);
    provider.on("status", ({ status }: { status: string }) => {
      console.log("[Yjs] WebSocket 狀態:", status);
      setConnected(status === "connected");
    });

    const onTransaction = (transaction: Y.Transaction) => {
      if (!session.synced) return;

      const isLocal = transaction.origin === localOrigin;

      console.log("[Yjs] 資料交易:", {
        isLocal,
        nodeCount: nodes.size,
        edgeCount: edges.size,
        origin: transaction.origin,
      });

      if (!isLocal) {
        const graph = readGraph(session);
        rememberWorkflowInitialization(workflowId, graph);

        console.log("[Yjs] 收到共享畫布:", {
          nodes: graph.nodes.length,
          edges: graph.edges.length,
        });

        callbackRef.current(graph);
      }

      forceRefresh((v) => v + 1);
    };

    doc.on("afterTransaction", onTransaction);
    const onYjsUpdate = (update: Uint8Array, origin: unknown) => {
      console.log("[Yjs] 文件更新:", {
        bytes: update.byteLength,
        origin,
      });
    };

    doc.on("update", onYjsUpdate);

    const onSync = (isSynced: boolean) => {
      console.log("[Yjs] 首次同步事件:", isSynced);

      if (!isSynced || session.synced) return;
      session.synced = true;
      if (!metadata.get("initialized")) {
        // An empty legacy document can still contain the history of deleted nodes.
        const hasHistory =
          Y.decodeStateVector(Y.encodeStateVector(doc)).size > 0;
        doc.transact(() => {
          if (!hasHistory && nodes.size === 0 && edges.size === 0) {
            for (const node of initialRef.current.nodes) {
              const record = new Y.Map<unknown>();
              nodes.set(node.id, record);
              writeNode(record, node);
            }
            for (const edge of initialRef.current.edges)
              edges.set(edge.id, stripEdge(edge));
          }
          metadata.set("initialized", true);
        }, "bootstrap");
      }
      const graph = readGraph(session);
      rememberWorkflowInitialization(workflowId, graph);
      callbackRef.current(graph);
      undoManager.clear();
      setReady(true);
      updatePresence();
    };
    provider.on("sync", onSync);

    return () => {
      sessionRef.current = null;
      provider.awareness.off("change", updatePresence);
      provider.off("sync", onSync);
      doc.off("afterTransaction", onTransaction);
      provider.destroy();
      undoManager.destroy();
      doc.off("update", onYjsUpdate);
      doc.off("update", onDocUpdate);
      doc.destroy();
    };
  }, [workflowId]);

  const publish = useCallback(
    (next: Graph) => {
      const session = sessionRef.current;
      if (!session?.synced) {
        console.warn("[Yjs] 尚未同步，無法發布");
        return;
      }
      console.log("[Yjs] 發布節點:", next.nodes.length);
      console.log("[Yjs] 發布連線:", next.edges.length);
      const { doc, nodes, edges, localOrigin } = session;
      doc.transact(() => {
        const currentNodeIds = new Set(next.nodes.map((node) => node.id));
        const currentEdgeIds = new Set(next.edges.map((edge) => edge.id));
        for (const id of Array.from(nodes.keys()))
          if (!currentNodeIds.has(id)) nodes.delete(id);
        for (const id of Array.from(edges.keys()))
          if (!currentEdgeIds.has(id)) edges.delete(id);
        for (const node of next.nodes) {
          let record = nodes.get(node.id);
          if (!record) {
            record = new Y.Map<unknown>();
            nodes.set(node.id, record);
          }
          writeNode(record, node);
        }
        for (const edge of next.edges) {
          const serialized = stripEdge(edge);
          if (edges.get(edge.id) !== serialized) edges.set(edge.id, serialized);
        }
      }, localOrigin);
      rememberWorkflowInitialization(workflowId, next);
    },
    [workflowId],
  );

  const stopCapture = useCallback(
    () => sessionRef.current?.undoManager.stopCapturing(),
    [],
  );
  const undo = useCallback(() => {
    const manager = sessionRef.current?.undoManager;
    if (!manager) return;
    manager.stopCapturing();
    manager.undo();
    manager.stopCapturing();
  }, []);
  const redo = useCallback(() => {
    const manager = sessionRef.current?.undoManager;
    if (!manager) return;
    manager.stopCapturing();
    manager.redo();
    manager.stopCapturing();
  }, []);

  return {
    ready,
    connected,
    onlineCount,
    publish,
    stopCapture,
    undo,
    redo,
    canUndo: Boolean(sessionRef.current?.undoManager.undoStack.length),
    canRedo: Boolean(sessionRef.current?.undoManager.redoStack.length),
  };
}
