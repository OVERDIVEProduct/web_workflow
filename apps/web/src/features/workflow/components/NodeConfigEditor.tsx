import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Braces,
  Check,
  CircleHelp,
  Plus,
  Trash2,
  Play,
  Square,
} from "lucide-react";
import HttpRequestEditor, {
  defaults as httpDefaults,
  type Config as HttpConfig,
} from "./HttpRequestEditor";
import NodeDataViewer, { type ViewerItem } from "./NodeDataViewer";
import type { WorkflowNode } from "../types/workflow";
import { isInitialItems } from "../../../../../../packages/shared/src/workflowData.js";
import { useNodeConfigAutoSave } from "./useNodeConfigAutoSave";
import "./nodeConfigEditor.css";

type Config = Record<string, unknown>;
export type ConfigChange = { key: string; expected: unknown; value: unknown };
type RunEntry = {
  id: string;
  status: string;
  inputItems: unknown[];
  outputItemsByPort: Record<string, unknown[]>;
  durationMs?: number;
  error?: string;
  httpResponses?: Array<{
    statusCode: number;
    statusText: string;
    durationMs: number;
    responseBytes: number;
    contentType: string;
  }>;
};
type Rule = { field: string; operator: string; value: unknown };
type FieldRow = { name: string; value: unknown; remove?: boolean };
type SortRow = { field: string; direction: string };
const base: Record<string, Config> = {
  manualTrigger: { initialItems: [{}] },
  filter: {
    conditions: [{ field: "value", operator: "notEmpty", value: "" }],
    combine: "and",
  },
  if: {
    conditions: [{ field: "value", operator: "notEmpty", value: "" }],
    combine: "and",
  },
  set: {
    keepOtherFields: true,
    fields: [{ name: "newField", value: "{{$json.value}}" }],
  },
  sort: { fields: [{ field: "value", direction: "asc" }] },
  limit: { count: 10, position: "first" },
  output: {},
};
const names: Record<string, string> = {
  manualTrigger: "Manual Trigger",
  filter: "Filter",
  if: "IF",
  set: "Edit Fields (Set)",
  sort: "Sort",
  limit: "Limit",
  output: "Output",
};
const help: Record<string, string> = {
  manualTrigger: "手動執行工作流程時，將以下 JSON 作為第一批輸出資料。",
  filter: "逐筆檢查 INPUT，僅將符合條件的項目傳給下一個節點。",
  if: "逐筆判斷 INPUT，依條件從 True / False 兩個輸出端口傳遞。",
  set: "新增、修改或移除輸入項目的欄位。可使用 {{$json.field}} 引用目前資料。",
  sort: "依指定欄位排序本次收到的資料；多條輸入路線會分別排序。",
  limit: "僅輸出指定數量的資料；多條輸入路線會分別計算。",
  output: "工作流程的終點，顯示每次接收到的輸入結果。",
};
const operatorOptions = [
  ["eq", "等於"],
  ["ne", "不等於"],
  ["gt", "大於"],
  ["gte", "大於或等於"],
  ["lt", "小於"],
  ["lte", "小於或等於"],
  ["contains", "包含"],
  ["empty", "為空"],
  ["notEmpty", "不為空"],
];
const needsValue = (op: string) => op !== "empty" && op !== "notEmpty";
const fieldPath = (s: string) =>
  s
    .trim()
    .replace(/^{{\s*\$json\./, "")
    .replace(/\s*}}$/, "")
    .replace(/^\$json\./, "");
const emptyRule = (): Rule => ({ field: "", operator: "eq", value: "" });
const emptyField = (): FieldRow => ({ name: "", value: "" });
const emptySort = (): SortRow => ({ field: "", direction: "asc" });
const jsonText = (v: unknown) =>
  typeof v === "string" ? v : JSON.stringify(v ?? null, null, 2);
const invalidFieldValue = Symbol("invalid field value");
const parseTyped = (
  value: string,
  mode: "string" | "number" | "boolean" | "json",
): unknown => {
  if (mode === "number") {
    if (value.trim() === "") throw Error("數字欄位不可空白");
    const n = Number(value);
    if (!Number.isFinite(n)) throw Error("請輸入有效數字");
    return n;
  }
  if (mode === "boolean") return value === "true";
  if (mode === "json") {
    try {
      return JSON.parse(value);
    } catch {
      throw Error("JSON 格式不正確");
    }
  }
  return value;
};
function FieldValue({
  value,
  onChange,
  label,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  label?: string;
}) {
  const initialType =
    typeof value === "number"
      ? "number"
      : typeof value === "boolean"
        ? "boolean"
        : value !== null && typeof value === "object"
          ? "json"
          : "string";
  const [mode, setMode] = useState<"string" | "number" | "boolean" | "json">(
    initialType,
  );
  const [draft, setDraft] = useState(jsonText(value));
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (value !== invalidFieldValue) setDraft(jsonText(value));
  }, [value]);
  const update = (s: string, m = mode) => {
    setDraft(s);
    try {
      onChange(parseTyped(s, m));
      setMessage("");
    } catch (e) {
      onChange(invalidFieldValue);
      setMessage(e instanceof Error ? e.message : "輸入錯誤");
    }
  };
  const setType = (m: "string" | "number" | "boolean" | "json") => {
    setMode(m);
    let s = draft;
    if (m === "boolean") s = "false";
    else if (m === "number" && !Number.isFinite(Number(draft))) s = "0";
    else if (m === "json") {
      try {
        JSON.parse(s);
      } catch {
        s = "{}";
      }
    }
    update(s, m);
  };
  return (
    <div className="nce-value">
      <div className="nce-value-head">
        <span>{label || "Value"}</span>
        <select
          aria-label="欄位資料型別"
          value={mode}
          onChange={(e) => setType(e.target.value as typeof mode)}
        >
          <option value="string">String / Expression</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="json">JSON</option>
        </select>
      </div>
      {mode === "boolean" ? (
        <select
          value={draft === "true" ? "true" : "false"}
          onChange={(e) => update(e.target.value)}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : mode === "json" ? (
        <textarea
          rows={3}
          spellCheck={false}
          value={draft}
          onChange={(e) => update(e.target.value)}
        />
      ) : (
        <input
          type={mode === "number" ? "number" : "text"}
          value={draft}
          placeholder={mode === "string" ? "固定值或 {{$json.name}}" : "0"}
          onChange={(e) => update(e.target.value)}
        />
      )}
      {message && (
        <small className="nce-error">{message}（儲存前請修正）</small>
      )}
    </div>
  );
}
function Rules({
  config,
  onChange,
}: {
  config: Config;
  onChange: (p: Config) => void;
}) {
  const rules: Rule[] = Array.isArray(config.conditions)
    ? (config.conditions as Rule[])
    : [
        {
          field: String(config.field || "value"),
          operator: String(config.operator || "notEmpty"),
          value: config.value ?? "",
        },
      ];
  const setRules = (next: Rule[]) => onChange({ conditions: next });
  const modify = (i: number, p: Partial<Rule>) =>
    setRules(rules.map((r, j) => (i === j ? { ...r, ...p } : r)));
  return (
    <>
      <div className="nce-section-head">
        <h3>Conditions</h3>
        <span>逐筆判斷輸入資料</span>
      </div>
      {rules.map((r, i) => (
        <div className="nce-rule" key={i}>
          {i > 0 && (
            <div className="nce-join">
              {String(config.combine || "and").toUpperCase()}
            </div>
          )}
          <div className="nce-row">
            <div className="nce-control nce-grow">
              <label>欄位路徑</label>
              <input
                value={r.field}
                placeholder="例如 stock 或 user.age"
                onChange={(e) => modify(i, { field: e.target.value })}
              />
            </div>
            <div className="nce-control nce-grow">
              <label>比較方式</label>
              <select
                value={r.operator}
                onChange={(e) => modify(i, { operator: e.target.value })}
              >
                {operatorOptions.map(([id, label]) => (
                  <option value={id} key={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="nce-icon-button"
              aria-label="刪除此條件"
              title="刪除此條件"
              disabled={rules.length <= 1}
              onClick={() => setRules(rules.filter((_, j) => i !== j))}
            >
              <Trash2 size={16} />
            </button>
          </div>
          {needsValue(r.operator) && (
            <FieldValue
              key={`${i}-${r.operator}`}
              label="比較值"
              value={r.value}
              onChange={(v) => modify(i, { value: v })}
            />
          )}
        </div>
      ))}
      <button
        className="nce-add"
        onClick={() => setRules([...rules, emptyRule()])}
      >
        <Plus size={15} /> 新增條件
      </button>
      {rules.length > 1 && (
        <div className="nce-control">
          <label>多條條件如何組合</label>
          <select
            value={String(config.combine || "and")}
            onChange={(e) => onChange({ combine: e.target.value })}
          >
            <option value="and">AND — 全部條件都符合</option>
            <option value="or">OR — 符合任一條件</option>
          </select>
        </div>
      )}
    </>
  );
}
function SetFields({
  config,
  onChange,
}: {
  config: Config;
  onChange: (p: Config) => void;
}) {
  const fields: FieldRow[] = Array.isArray(config.fields)
    ? (config.fields as FieldRow[])
    : [];
  const setFields = (next: FieldRow[]) => onChange({ fields: next });
  const modify = (i: number, p: Partial<FieldRow>) =>
    setFields(fields.map((f, j) => (i === j ? { ...f, ...p } : f)));
  return (
    <>
      <div className="nce-section-head">
        <h3>Fields to Set</h3>
        <span>依序處理每個項目</span>
      </div>
      {fields.map((f, i) => (
        <div className="nce-rule" key={i}>
          <div className="nce-row">
            <div className="nce-control nce-grow">
              <label>欄位名稱</label>
              <input
                placeholder="例如 total"
                value={f.name}
                onChange={(e) => modify(i, { name: e.target.value })}
              />
            </div>
            <div className="nce-control">
              <label>動作</label>
              <select
                value={f.remove ? "remove" : "set"}
                onChange={(e) =>
                  modify(i, { remove: e.target.value === "remove" })
                }
              >
                <option value="set">新增／覆寫</option>
                <option value="remove">刪除</option>
              </select>
            </div>
            <button
              className="nce-icon-button"
              aria-label="刪除此列"
              onClick={() => setFields(fields.filter((_, j) => i !== j))}
            >
              <Trash2 size={16} />
            </button>
          </div>
          {!f.remove && (
            <FieldValue
              label="欄位值"
              value={f.value}
              onChange={(v) => modify(i, { value: v })}
            />
          )}
        </div>
      ))}
      <button
        className="nce-add"
        onClick={() => setFields([...fields, emptyField()])}
      >
        <Plus size={15} /> 新增欄位
      </button>
      <label className="nce-check">
        <input
          type="checkbox"
          checked={config.keepOtherFields !== false}
          onChange={(e) => onChange({ keepOtherFields: e.target.checked })}
        />{" "}
        保留輸入資料的其他欄位
      </label>
    </>
  );
}
function SortFields({
  config,
  onChange,
}: {
  config: Config;
  onChange: (p: Config) => void;
}) {
  const fields: SortRow[] = Array.isArray(config.fields)
    ? (config.fields as SortRow[])
    : [
        {
          field: String(config.field || "value"),
          direction: String(config.direction || "asc"),
        },
      ];
  const setFields = (v: SortRow[]) => onChange({ fields: v });
  return (
    <>
      <div className="nce-section-head">
        <h3>Sort by</h3>
        <span>由上往下依序排序</span>
      </div>
      {fields.map((f, i) => (
        <div className="nce-row nce-sort" key={i}>
          <div className="nce-control nce-grow">
            <label>欄位路徑</label>
            <input
              placeholder="例如 price"
              value={f.field}
              onChange={(e) =>
                setFields(
                  fields.map((x, j) =>
                    i === j ? { ...x, field: e.target.value } : x,
                  ),
                )
              }
            />
          </div>
          <div className="nce-control">
            <label>排序方向</label>
            <select
              value={f.direction}
              onChange={(e) =>
                setFields(
                  fields.map((x, j) =>
                    i === j ? { ...x, direction: e.target.value } : x,
                  ),
                )
              }
            >
              <option value="asc">升冪 A → Z</option>
              <option value="desc">降冪 Z → A</option>
            </select>
          </div>
          <button
            className="nce-icon-button"
            aria-label="刪除此排序欄位"
            disabled={fields.length === 1}
            onClick={() => setFields(fields.filter((_, j) => i !== j))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        className="nce-add"
        onClick={() => setFields([...fields, emptySort()])}
      >
        <Plus size={15} /> 新增排序欄位
      </button>
    </>
  );
}
const createConfig = (node: WorkflowNode): Config => {
  const defaults =
    node.type === "httpRequest"
      ? { ...httpDefaults() }
      : base[node.type || ""] || {};
  const incoming = { ...(node.data.config || {}) };
  if (
    ["filter", "if"].includes(node.type || "") &&
    !Array.isArray(incoming.conditions)
  )
    incoming.conditions = [
      {
        field: String(incoming.field || "value"),
        operator: String(incoming.operator || "notEmpty"),
        value: incoming.value ?? "",
      },
    ];
  if (node.type === "sort" && !Array.isArray(incoming.fields))
    incoming.fields = [
      {
        field: String(incoming.field || "value"),
        direction: String(incoming.direction || "asc"),
      },
    ];
  return {
    ...defaults,
    ...incoming,
    ...(node.type === "httpRequest" ? { auth: "None" } : {}),
  };
};

type StepEntry = RunEntry & {
  sourceEdgeId?: string | null;
  sourceNodeRunId?: string | null;
};
type SourceRun = StepEntry & { nodeId: string };
const validItems = (items: unknown): items is ViewerItem[] =>
  Array.isArray(items) &&
  items.every(
    (i) =>
      i &&
      typeof i === "object" &&
      "json" in i &&
      i.json &&
      typeof i.json === "object" &&
      !Array.isArray(i.json),
  );
export default function NodeConfigEditor({
  node,
  onChange,
  onClose,
  nodeRuns = [],
  allNodeRuns = [],
  edges = [],
  nodeLabels = {},
  apiBase = "/api",
  workflowId,
  onExecuteToHere,
  onCancelExecution,
  executionBusy = false,
  targetStatus,
  executionError = "",
  stale = false,
}: {
  node: WorkflowNode;
  onChange: (changes: ConfigChange[], defaults: Config) => Config;
  onClose: () => void;
  nodeRuns?: StepEntry[];
  allNodeRuns?: SourceRun[];
  edges?: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
  }>;
  nodeLabels?: Record<string, string>;
  apiBase?: string;
  workflowId: string;
  onExecuteToHere?: () => Promise<void>;
  onCancelExecution?: () => void;
  executionBusy?: boolean;
  targetStatus?: string;
  executionError?: string;
  stale?: boolean;
}) {
  const [config, setConfig] = useState<Config>(() => createConfig(node));
  const configRef = useRef(config);
  configRef.current = config;
  const [tab, setTab] = useState<"Parameters" | "Settings">("Parameters");
  const [jsonMode, setJsonMode] = useState(false);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");
  const [initialText, setInitialText] = useState(() =>
    JSON.stringify(config.initialItems ?? [{}], null, 2),
  );
  const appliedForm = useRef({ config, initialText });
  const appliedConfig = useRef(config);
  const expectedConfig = useRef<Config>({ ...node.data.config });
  const [selectedRun, setSelectedRun] = useState("");
  const [stepRuns, setStepRuns] = useState<StepEntry[]>([]);
  const [hidePreviousOutput, setHidePreviousOutput] = useState(false);
  const [running, setRunning] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [mockText, setMockText] = useState('[{"json":{}}]');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const allRuns = [...stepRuns, ...nodeRuns].filter(
    (entry, index, entries) =>
      entries.findIndex((other) => other.id === entry.id) === index,
  );
  const currentRun =
    hidePreviousOutput || executionBusy
      ? undefined
      : allRuns.find((r) => r.id === selectedRun) ||
        nodeRuns.at(-1) ||
        (!targetStatus ? stepRuns.at(-1) : undefined);
  const kind = node.type || "output";
  const title = names[kind] || "HTTP Request";
  const upstream = edges.filter((e) => e.target === node.id);
  const source = upstream
    .map((edge) => ({
      edge,
      run: [...allNodeRuns]
        .reverse()
        .find(
          (r) =>
            r.nodeId === edge.source &&
            (!edge.sourceHandle ||
              (r.outputItemsByPort[edge.sourceHandle || "main"] || []).length >
                0),
        ),
    }))
    .filter((entry) => entry.run);
  const [sourceId, setSourceId] = useState("");
  const selectedSource =
    source.find((s) => `${s.edge.id}:${s.run?.id}` === sourceId) ||
    source.at(-1);
  const upstreamItems =
    selectedSource?.run?.outputItemsByPort[
      selectedSource.edge.sourceHandle || "main"
    ];
  const inputItems =
    currentRun?.inputItems ??
    (validItems(upstreamItems) ? upstreamItems : null);
  const outputPort = currentRun?.outputItemsByPort || {};
  const outputItems = currentRun
    ? Object.values(outputPort)
        .flat()
        .filter(
          (i): i is ViewerItem =>
            i !== null && typeof i === "object" && "json" in i,
        )
    : null;
  const [outputHandle, setOutputHandle] = useState("main");
  const showingOutput =
    kind === "if"
      ? ((outputPort[outputHandle === "false" ? "false" : "true"] ||
          []) as ViewerItem[])
      : kind === "output"
        ? ((outputPort.main || currentRun?.inputItems || []) as ViewerItem[])
        : outputItems;
  const update = (patch: Config) => {
    setConfig((c) => ({ ...c, ...patch }));
    setError("");
  };
  const toggleAdvanced = () => {
    if (!jsonMode) {
      const entries = [
        ...(Array.isArray(config.conditions) ? config.conditions : []),
        ...(Array.isArray(config.fields) ? config.fields : []),
      ];
      if (entries.some((entry) => entry?.value === invalidFieldValue)) return;
      let current = config;
      if (kind === "manualTrigger") {
        try {
          current = { ...config, initialItems: JSON.parse(initialText) };
        } catch {
          return;
        }
      }
      setRaw(JSON.stringify(current, null, 2));
      setJsonMode(true);
      setError("");
      return;
    }
    try {
      const next = JSON.parse(raw);
      if (!next || typeof next !== "object" || Array.isArray(next))
        throw Error("設定必須是 JSON 物件");
      setConfig(next);
      if (kind === "manualTrigger")
        setInitialText(JSON.stringify(next.initialItems ?? [{}], null, 2));
      setJsonMode(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "JSON 格式錯誤");
    }
  };
  const prepareConfig = () => {
    let next = configRef.current;
    if (jsonMode) {
      const obj: unknown = JSON.parse(raw);
      if (!obj || typeof obj !== "object" || Array.isArray(obj))
        throw Error("設定必須是 JSON 物件");
      next = obj as Config;
    } else if (kind === "manualTrigger") {
      next = { ...next, initialItems: JSON.parse(initialText) };
    }
    if (
      kind === "manualTrigger" &&
      next.initialItems !== undefined &&
      !isInitialItems(next.initialItems)
    ) {
      throw Error("Initial Items 必須是 JSON 物件或物件陣列。");
    }
    if (["filter", "if"].includes(kind)) {
      const rules = next.conditions as Rule[] | undefined;
      if (
        !Array.isArray(rules) ||
        !rules.length ||
        rules.some((r) => typeof r?.field !== "string" || !fieldPath(r.field))
      )
        throw Error("請至少設定一條有效的條件欄位");
      if (rules.some((r) => r.value === invalidFieldValue)) {
        if (
          rules.some(
            (r) => needsValue(r.operator) && r.value === invalidFieldValue,
          )
        )
          throw Error("請修正無效的比較值。");
        next = {
          ...next,
          conditions: rules.map((r) =>
            r.value === invalidFieldValue ? { ...r, value: "" } : r,
          ),
        };
      }
    }
    if (
      kind === "sort" &&
      next.fields !== undefined &&
      (!Array.isArray(next.fields) ||
        next.fields.some(
          (f) => typeof f?.field !== "string" || !fieldPath(f.field),
        ))
    )
      throw Error("排序欄位不可空白");
    if (
      kind === "limit" &&
      next.count !== undefined &&
      (next.count === "" ||
        !Number.isInteger(Number(next.count)) ||
        Number(next.count) < 0)
    )
      throw Error("Limit 數量須為非負整數");
    if (
      kind === "set" &&
      next.fields !== undefined &&
      (!Array.isArray(next.fields) ||
        next.fields.some(
          (f) =>
            typeof f?.name !== "string" ||
            !f.name.trim() ||
            (!f.remove && f.value === invalidFieldValue),
        ))
    )
      throw Error("請修正 Set 的欄位名稱或欄位值。");
    if (
      kind === "set" &&
      Array.isArray(next.fields) &&
      next.fields.some((f) => f.value === invalidFieldValue)
    ) {
      next = {
        ...next,
        fields: next.fields.map((f) =>
          f.value === invalidFieldValue ? { ...f, value: "" } : f,
        ),
      };
    }
    if (kind === "httpRequest") {
      if (typeof next.url !== "string" || !next.url.trim())
        throw Error("請輸入 HTTP URL。");
      if (
        next.bodyEnabled &&
        typeof next.body === "string" &&
        next.body.trim() &&
        !next.body.includes("{{")
      )
        JSON.parse(next.body);
    }
    return next;
  };
  const draftChanged = jsonMode
    ? raw !== JSON.stringify(appliedForm.current.config, null, 2)
    : JSON.stringify(config) !== JSON.stringify(appliedForm.current.config) ||
      (kind === "manualTrigger" &&
        initialText !== appliedForm.current.initialText);
  const autoSave = useNodeConfigAutoSave(
    JSON.stringify([config, jsonMode, raw, initialText]),
    draftChanged,
    () => {
      try {
        return { value: prepareConfig() };
      } catch (cause) {
        return {
          error: cause instanceof Error ? cause.message : String(cause),
        };
      }
    },
    (next) => {
      const previous = appliedConfig.current;
      const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
      const changes = [...keys]
        .filter(
          (key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]),
        )
        .map((key) => ({
          key,
          expected: expectedConfig.current[key],
          value: next[key],
        }));
      const missingDefaults = Object.fromEntries(
        Object.entries(next).filter(
          ([key]) => !Object.hasOwn(expectedConfig.current, key),
        ),
      );
      const merged = onChange(changes, missingDefaults);
      for (const key of new Set([
        ...Object.keys(missingDefaults),
        ...changes.map((change) => change.key),
      ])) {
        if (JSON.stringify(merged[key]) === JSON.stringify(next[key])) {
          expectedConfig.current[key] = merged[key];
        }
      }
      appliedConfig.current = next;
      appliedForm.current = { config: jsonMode ? next : config, initialText };
      return merged;
    },
  );
  const saveClose = () => {
    if (running || executionBusy) return;
    if (
      !draftChanged ||
      autoSave.flush() ||
      window.confirm("設定尚未套用。要捨棄未套用的變更並返回畫布嗎？")
    )
      onClose();
  };
  const executeToHere = async () => {
    if (running || executionBusy || !onExecuteToHere || !autoSave.flush(true))
      return;
    setError("");
    setSelectedRun("");
    setHidePreviousOutput(true);
    setOutputHandle(kind === "if" ? "true" : "main");
    try {
      await onExecuteToHere();
      setHidePreviousOutput(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  const execute = async () => {
    if (running || executionBusy) return;
    const next = autoSave.flush(true);
    if (!next) return;
    let items: ViewerItem[] = [];
    if (kind !== "manualTrigger") {
      if (mockMode) {
        try {
          const value: unknown = JSON.parse(mockText);
          if (!validItems(value))
            throw Error('測試資料格式必須是 [{"json":{...}}]');
          items = value;
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          return;
        }
      } else if (kind === "httpRequest" && upstream.length === 0)
        items = [{ json: {} }];
      else {
        setError(
          "尚未取得上游 INPUT；請先執行 Workflow，或勾選「使用測試輸入」",
        );
        return;
      }
    }
    const controller = new AbortController();
    abort.current = controller;
    setHidePreviousOutput(true);
    setRunning(true);
    setError("");
    setSelectedRun("");
    try {
      const res = await fetch(`${apiBase}/steps`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          node: { ...node, data: { ...node.data, config: next } },
          inputItems: items,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || "單節點執行失敗");
      setStepRuns((old) => [...old, data as StepEntry]);
      setSelectedRun(data.id);
      setHidePreviousOutput(false);
      setOutputHandle(kind === "if" ? "true" : "main");
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : String(e));
      else setError("已取消等待單節點執行結果；外部 HTTP 操作可能仍在進行。");
    } finally {
      setRunning(false);
      abort.current = null;
    }
  };
  return (
    <div
      className="nce-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} 設定`}
    >
      <div className="nce-shell">
        <header className="nce-top">
          <button
            className="nce-back"
            disabled={running || executionBusy}
            onClick={saveClose}
          >
            <ArrowLeft size={17} /> 返回畫布
          </button>
          <div className="nce-title">
            <strong>{title}</strong>
            <span>
              {node.data.label} · {node.id.slice(0, 10)}
            </span>
          </div>
          <span className="ns-status" aria-live="polite">
            {running || executionBusy
              ? "執行中…"
              : stale || (currentRun && draftChanged)
                ? "待重新測試"
                : currentRun?.status || "尚未執行"}
          </span>
          {running || executionBusy ? (
            <button
              className="nce-stop"
              onClick={() =>
                running ? abort.current?.abort() : onCancelExecution?.()
              }
            >
              <Square size={15} /> 取消執行
            </button>
          ) : (
            <button
              className="nce-execute"
              onClick={() =>
                void (kind === "manualTrigger" ||
                mockMode ||
                (kind === "httpRequest" && upstream.length === 0)
                  ? execute()
                  : executeToHere())
              }
            >
              <Play size={15} /> 測試到此節點
            </button>
          )}
        </header>
        <div
          className={
            kind === "manualTrigger"
              ? "nce-columns nce-columns-trigger"
              : "nce-columns"
          }
        >
          {kind !== "manualTrigger" && (
            <aside className="nce-input">
              <div className="nce-column-head">
                INPUT <span>上游資料</span>
              </div>
              {allRuns.length > 1 && (
                <select
                  className="nce-run-select"
                  aria-label="節點執行紀錄"
                  value={currentRun?.id || ""}
                  onChange={(e) => {
                    setSelectedRun(e.target.value);
                    setHidePreviousOutput(false);
                  }}
                >
                  {allRuns.map((r, i) => (
                    <option key={r.id} value={r.id}>
                      第 {i + 1} 次 · {r.status}
                    </option>
                  ))}
                </select>
              )}
              {source.length > 0 && !currentRun && (
                <select
                  className="nce-run-select"
                  aria-label="上游來源"
                  value={
                    selectedSource
                      ? `${selectedSource.edge.id}:${selectedSource.run?.id}`
                      : ""
                  }
                  onChange={(e) => setSourceId(e.target.value)}
                >
                  {source.map((s) => (
                    <option
                      key={s.run!.id + s.edge.id}
                      value={`${s.edge.id}:${s.run!.id}`}
                    >
                      {nodeLabels[s.edge.source] || s.edge.source} ·{" "}
                      {s.run!.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              )}
              {currentRun?.sourceEdgeId && (
                <p className="ns-source">
                  來源：
                  {nodeLabels[
                    edges.find((e) => e.id === currentRun.sourceEdgeId)
                      ?.source || ""
                  ] || "上一節點"}{" "}
                  · {currentRun.sourceEdgeId}
                </p>
              )}
              {mockMode ? (
                <textarea
                  className="ns-mock"
                  spellCheck={false}
                  aria-label="測試輸入 JSON"
                  value={mockText}
                  onChange={(e) => setMockText(e.target.value)}
                />
              ) : (
                <NodeDataViewer
                  items={
                    inputItems && validItems(inputItems) ? inputItems : null
                  }
                  emptyText="沒有上游執行資料；請先執行 Workflow 或使用測試輸入。"
                />
              )}
              <label className="ns-mock-toggle">
                <input
                  type="checkbox"
                  checked={mockMode}
                  onChange={(e) => setMockMode(e.target.checked)}
                />{" "}
                使用測試輸入（不取代真實上游資料）
              </label>
              <div className="nce-footnote">
                Expression：<code>{"{{$json.field}}"}</code>
              </div>
            </aside>
          )}
          <section className="nce-main">
            <div className="nce-tabs">
              <button
                className={tab === "Parameters" ? "active" : ""}
                onClick={() => setTab("Parameters")}
              >
                Parameters
              </button>
              <button
                className={tab === "Settings" ? "active" : ""}
                onClick={() => setTab("Settings")}
              >
                Settings
              </button>
              {kind !== "httpRequest" && (
                <button className="nce-advanced" onClick={toggleAdvanced}>
                  <Braces size={15} />
                  {jsonMode ? "表單模式" : "進階 JSON"}
                </button>
              )}
            </div>
            <div className="nce-scroll">
              {kind === "httpRequest" ? (
                <HttpRequestEditor
                  workflowId={workflowId}
                  nodeId={node.id}
                  embedded
                  onClose={() => {}}
                  initialConfig={config}
                  activeTab={tab}
                  onConfigChange={(v: HttpConfig) => {
                    setConfig(v as unknown as Config);
                    configRef.current = v as unknown as Config;
                  }}
                />
              ) : jsonMode ? (
                <div className="nce-control">
                  <label>進階設定 JSON</label>
                  <textarea
                    className="nce-json"
                    value={raw}
                    spellCheck={false}
                    onChange={(e) => setRaw(e.target.value)}
                  />
                </div>
              ) : tab === "Settings" ? (
                <div className="nce-message">
                  <CircleHelp size={20} />
                  <div>
                    <strong>執行設定</strong>
                    <p>此節點使用後端工作流程引擎的預設執行規則。</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="nce-description">
                    {help[kind] || "設定節點參數。"}
                  </div>
                  {kind === "manualTrigger" && (
                    <div className="nce-control">
                      <label htmlFor="initial-items">
                        Initial Items (JSON)
                      </label>
                      <textarea
                        id="initial-items"
                        rows={11}
                        spellCheck={false}
                        value={initialText}
                        onChange={(e) => setInitialText(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setInitialText("[{}]")}
                      >
                        重置初始資料
                      </button>
                    </div>
                  )}
                  {(kind === "filter" || kind === "if") && (
                    <Rules config={config} onChange={update} />
                  )}
                  {kind === "set" && (
                    <SetFields config={config} onChange={update} />
                  )}
                  {kind === "sort" && (
                    <SortFields config={config} onChange={update} />
                  )}
                  {kind === "limit" && (
                    <>
                      <div className="nce-section-head">
                        <h3>Limit</h3>
                      </div>
                      <div className="nce-control">
                        <label>Max Items</label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={String(config.count ?? 10)}
                          onChange={(e) =>
                            update({
                              count:
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="nce-control">
                        <label>Keep</label>
                        <select
                          value={String(config.position || "first")}
                          onChange={(e) => update({ position: e.target.value })}
                        >
                          <option value="first">First Items</option>
                          <option value="last">Last Items</option>
                        </select>
                      </div>
                    </>
                  )}
                  {kind === "output" && (
                    <div className="nce-message">
                      <Check size={18} />
                      <div>
                        <strong>不需要參數</strong>
                        <p>Output 記錄每次收到的資料；多條路線獨立執行。</p>
                      </div>
                    </div>
                  )}
                </>
              )}
              {autoSave.error && (
                <p role="alert" className="nce-error-banner">
                  {autoSave.error}
                </p>
              )}
              {autoSave.status && (
                <p role="status" className="nce-save-notice">
                  {autoSave.status}
                </p>
              )}
            </div>
          </section>
          <aside className="nce-output">
            <div className="nce-column-head">
              OUTPUT {kind === "output" ? "(終點接收資料)" : ""}{" "}
              <span>
                {currentRun?.durationMs ?? "—"} ms ·{" "}
                {currentRun?.status || "未執行"}
              </span>
            </div>
            {(error || executionError) && (
              <p role="alert" className="nce-error-banner">
                {error || executionError}
              </p>
            )}
            {currentRun?.error && (
              <p role="alert" className="nce-error-banner">
                {currentRun.error}
              </p>
            )}
            {currentRun?.httpResponses?.map((r, i) => (
              <p className="ns-http-response" key={i}>
                HTTP {r.statusCode} {r.statusText} · {r.durationMs} ms ·{" "}
                {(r.responseBytes / 1024).toFixed(1)} KB{" "}
                {(currentRun?.httpResponses?.length ?? 0) > 1
                  ? `（第 ${i + 1} 次請求）`
                  : ""}
              </p>
            ))}
            {kind === "if" && (
              <div className="ns-port">
                <button
                  className={outputHandle === "true" ? "active" : ""}
                  onClick={() => setOutputHandle("true")}
                >
                  True ({outputPort.true?.length || 0})
                </button>
                <button
                  className={outputHandle === "false" ? "active" : ""}
                  onClick={() => setOutputHandle("false")}
                >
                  False ({outputPort.false?.length || 0})
                </button>
              </div>
            )}
            {kind === "filter" &&
              currentRun?.status === "success" &&
              currentRun.inputItems.length > 0 &&
              (currentRun.outputItemsByPort.main || []).length === 0 && (
                <p role="status" className="nce-filter-hint">
                  Filter
                  已執行成功，但全部資料都未通過條件。請檢查條件欄位與左側 INPUT
                  的 JSON 欄位是否一致。可用欄位：
                  {Object.keys(
                    (currentRun.inputItems[0] as ViewerItem)?.json || {},
                  ).join("、") || "（空物件）"}
                  。
                </p>
              )}
            {kind === "httpRequest" &&
              currentRun &&
              currentRun.inputItems.length > 1 && (
                <p className="nce-filter-hint">
                  此 HTTP 節點預設對每個輸入 Item 分別發送請求。本次輸入{" "}
                  {currentRun.inputItems.length} Items，可能發出多次 HTTP 請求。
                </p>
              )}
            <NodeDataViewer
              key={currentRun?.id ?? "pending"}
              items={currentRun ? showingOutput : null}
              emptyText={
                running || executionBusy
                  ? "節點正在執行…"
                  : error || executionError
                    ? "本次執行未取得有效結果；請查看錯誤訊息。"
                    : targetStatus === "success"
                      ? "此次沒有資料抵達此節點。"
                      : targetStatus === "cancelled"
                        ? "本次執行已取消。"
                        : kind === "manualTrigger"
                          ? "按「測試到此節點」查看初始資料。"
                          : "按「測試到此節點」查看結果。"
              }
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
