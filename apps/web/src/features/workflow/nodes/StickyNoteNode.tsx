import { useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useStickyNoteActions } from "./StickyNoteActions";
import type { WorkflowNode } from "../types/workflow";

export default function StickyNoteNode({
  id,
  data,
  selected,
}: NodeProps<WorkflowNode>) {
  const { commitText } = useStickyNoteActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(data.label);
  }, [data.label, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const finish = () => {
    if (!editing) return;
    setEditing(false);
    commitText(id, draft);
  };

  return (
    <div
      className={`sticky-note ${selected ? "selected" : ""}`}
      onDoubleClick={(event) => {
        event.stopPropagation();
        setDraft(data.label);
        setEditing(true);
      }}
      title={editing ? "Ctrl+Enter 完成編輯" : "雙擊編輯便條紙"}
    >
      <Handle type="target" position={Position.Left} id="in" />
      {editing ? (
        <textarea
          ref={inputRef}
          className="sticky-note-input nodrag nopan nowheel"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={finish}
          onKeyDown={(event) => {
            // 輸入模式不讓編輯器 Delete、複製貼上等快捷鍵接管。
            event.stopPropagation();
            if (event.key === "Escape") {
              event.preventDefault();
              setDraft(data.label);
              setEditing(false);
            }
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              finish();
            }
          }}
          placeholder="輸入便條紙內容..."
        />
      ) : (
        <div className="sticky-note-text">
          {data.label || "雙擊輸入內容..."}
        </div>
      )}
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
