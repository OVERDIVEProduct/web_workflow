import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Globe2,
  Play,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
type Row = {
  id: string;
  enabled: boolean;
  name: string;
  value: string;
  expression: boolean;
};
type Config = {
  method: HttpMethod;
  url: string;
  auth: "None";
  query: Row[];
  headers: Row[];
  bodyEnabled: boolean;
  body: string;
  timeout: number;
};
type Outcome = {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
  type: "json" | "text" | "empty";
  durationMs: number;
  responseBytes: number;
  itemCount: number | null;
};
const YOUBIKE_URL =
  "https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json";
const INPUT_DEFAULT = "";
const row = (name = "", value = "", expression = false): Row => ({
  id: crypto.randomUUID(),
  enabled: true,
  name,
  value,
  expression,
});
const defaults = (): Config => ({
  method: "GET",
  url: YOUBIKE_URL,
  auth: "None",
  query: [],
  headers: [row("Accept", "application/json")],
  bodyEnabled: false,
  body: '{\n  "example": true\n}',
  timeout: 30000,
});
const storeKeyFor = (workflowId: string, nodeId: string) =>
  `overdrive:http-request:${workflowId}:${nodeId}`;
function load(storeKey: string): Config {
  try {
    const saved = localStorage.getItem(storeKey);
    const parsed = saved ? (JSON.parse(saved) as Partial<Config>) : {};
    return { ...defaults(), ...parsed, auth: "None" };
  } catch {
    return defaults();
  }
}
function parseJson(s: string): { value: unknown; error: string } {
  if (!s.trim()) return { value: {}, error: "" };
  try {
    return { value: JSON.parse(s) as unknown, error: "" };
  } catch (e) {
    return {
      value: null,
      error: e instanceof Error ? e.message : "JSON 格式錯誤",
    };
  }
}
function valueText(v: unknown): string {
  return typeof v === "object" && v !== null
    ? JSON.stringify(v)
    : String(v ?? "");
}
function asRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value))
    return value.map((x) =>
      x && typeof x === "object" && !Array.isArray(x)
        ? (x as Record<string, unknown>)
        : { value: x },
    );
  if (value && typeof value === "object")
    return [value as Record<string, unknown>];
  return value === null ? [] : [{ value }];
}
function evaluate(raw: string, context: unknown): string {
  return raw.replace(/{{\s*([^{}]+)\s*}}/g, (_whole, expression: string) => {
    const matched = expression
      .trim()
      .match(/^\$json((?:\.[a-zA-Z_$][\w$]*|\[\d+\])*)$/);
    if (!matched)
      throw new Error(
        "示範版 Expression 僅支援 {{$json.欄位}} 與陣列索引，不執行任意 JavaScript。",
      );
    const path = matched[1].match(/[a-zA-Z_$][\w$]*|\d+/g) || [];
    let cursor: unknown = context;
    for (const key of path) {
      if (
        cursor === null ||
        typeof cursor !== "object" ||
        !(key in (cursor as Record<string, unknown>))
      )
        throw new Error(`INPUT 沒有欄位：${key}`);
      cursor = (cursor as Record<string, unknown>)[key];
    }
    return valueText(cursor);
  });
}
function Fields({
  title,
  values,
  onChange,
}: {
  title: string;
  values: Row[];
  onChange: (x: Row[]) => void;
}) {
  const update = (id: string, patch: Partial<Row>) =>
    onChange(values.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <section className="editor-rows">
      <div className="section-title">
        {title}
        <span>{values.length}</span>
      </div>
      <div className="kv-head">
        <span>啟用</span>
        <span>Key</span>
        <span>Value / Expression</span>
        <span />
      </div>
      {values.map((r) => (
        <div className="kv-row" key={r.id}>
          <input
            aria-label="啟用"
            type="checkbox"
            checked={r.enabled}
            onChange={(e) => update(r.id, { enabled: e.target.checked })}
          />
          <input
            aria-label="Key"
            value={r.name}
            onChange={(e) => update(r.id, { name: e.target.value })}
          />
          <div className="expression-input">
            <input
              aria-label="Value"
              className={r.expression ? "expression-active" : ""}
              value={r.value}
              onChange={(e) => update(r.id, { value: e.target.value })}
            />
            <button
              className={r.expression ? "mini active" : "mini"}
              title="切換 Expression 提示"
              onClick={() => update(r.id, { expression: !r.expression })}
            >
              <Braces size={14} />
            </button>
          </div>
          <button
            className="mini muted"
            title="刪除"
            onClick={() => onChange(values.filter((x) => x.id !== r.id))}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button className="add" onClick={() => onChange([...values, row()])}>
        <Plus size={15} /> 新增欄位
      </button>
    </section>
  );
}

export default function HttpRequestEditor({
  workflowId,
  nodeId,
  onClose,
}: {
  workflowId: string;
  nodeId: string;
  onClose: () => void;
}) {
  const storeKey = storeKeyFor(workflowId, nodeId);
  const [config, setConfig] = useState<Config>(() => load(storeKey));
  const [input, setInput] = useState(INPUT_DEFAULT);
  const [tab, setTab] = useState<"Parameters" | "Settings">("Parameters");
  const [inputTab, setInputTab] = useState<"JSON" | "Schema">("JSON");
  const [outputTab, setOutputTab] = useState<"Table" | "JSON" | "Schema">(
    "Table",
  );
  const [result, setResult] = useState<Outcome | null>(null);
  const [status, setStatus] = useState<
    "idle" | "running" | "success" | "failed" | "cancelled"
  >("idle");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("Saved");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [districtOnly, setDistrictOnly] = useState(false);
  const [bikesOnly, setBikesOnly] = useState(false);
  const [keywordOnly, setKeywordOnly] = useState(false);
  const [preview, setPreview] = useState(false);
  const [expression, setExpression] = useState("{{ $json.district }}");
  const [closeDialog, setCloseDialog] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );
  const update = (patch: Partial<Config>) =>
    setConfig((c) => ({ ...c, ...patch }));
  useEffect(() => {
    setSaved("Saving...");
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storeKey, JSON.stringify(config));
        setSaved("Saved");
      } catch {
        setSaved("Save failed");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [config, storeKey]);
  const parsed = useMemo(() => parseJson(input), [input]);
  const previewValue = useMemo(() => {
    try {
      return parsed.error ? parsed.error : evaluate(expression, parsed.value);
    } catch (e) {
      return e instanceof Error ? e.message : "無法解析";
    }
  }, [parsed, expression]);
  const dataRows = useMemo(
    () => (result?.type === "json" ? asRows(result.data) : []),
    [result],
  );
  const context =
    parsed.value &&
    typeof parsed.value === "object" &&
    !Array.isArray(parsed.value)
      ? (parsed.value as Record<string, unknown>)
      : {};
  const filteredRows = useMemo(
    () =>
      dataRows.filter((r) => {
        const area =
          !districtOnly ||
          !context.district ||
          String(r.sarea ?? "") === String(context.district);
        const bikes =
          !bikesOnly ||
          Number(r.available_rent_bikes ?? 0) >= Number(context.minBikes ?? 1);
        const keyword =
          !keywordOnly ||
          !context.keyword ||
          String(r.sna ?? "").includes(String(context.keyword));
        const match =
          !search ||
          Object.values(r).some((v) =>
            valueText(v).toLowerCase().includes(search.toLowerCase()),
          );
        return area && bikes && keyword && match;
      }),
    [dataRows, context, districtOnly, bikesOnly, keywordOnly, search],
  );
  const columns = useMemo(
    () =>
      Array.from(
        new Set(filteredRows.slice(0, 50).flatMap((x) => Object.keys(x))),
      ),
    [filteredRows],
  );
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visible = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const close = () => {
    if (status === "running") {
      setCloseDialog(true);
      return;
    }
    onClose();
  };
  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("cancelled");
    setError("已停止等待回應；若請求已發出，外部服務仍可能處理。");
  };
  const run = async () => {
    if (parsed.error) {
      setError("INPUT JSON 錯誤：" + parsed.error);
      return;
    }
    setResult(null);
    setError("");
    setStatus("running");
    setPage(1);
    const controller = new AbortController();
    abortRef.current = controller;
    const t = performance.now();
    const timeout = setTimeout(
      () => controller.abort("timeout"),
      Math.max(1000, Math.min(60000, config.timeout)),
    );
    try {
      const raw = evaluate(config.url, parsed.value);
      const url = new URL(raw);
      if (url.protocol !== "https:") throw Error("只允許 HTTPS 網址");
      // Local demo restriction, not a security boundary. Browser CORS still applies.
      if (
        ![
          "tcgbusfs.blob.core.windows.net",
          "jsonplaceholder.typicode.com",
          "httpbin.org",
        ].includes(url.hostname)
      )
        throw Error("此網址不在展示版的允許清單中");
      for (const r of config.query) {
        if (r.enabled && r.name)
          url.searchParams.append(r.name, evaluate(r.value, parsed.value));
      }
      const headers: Record<string, string> = {};
      for (const r of config.headers) {
        if (r.enabled && r.name)
          headers[r.name] = evaluate(r.value, parsed.value);
      }
      const method = config.method;
      const body =
        config.bodyEnabled && !["GET", "HEAD"].includes(method)
          ? evaluate(config.body, parsed.value)
          : undefined;
      if (body) {
        JSON.parse(body);
        if (
          !Object.keys(headers).some((h) => h.toLowerCase() === "content-type")
        )
          headers["Content-Type"] = "application/json";
      }
      const response = await fetch(url.toString(), {
        method,
        headers,
        body,
        signal: controller.signal,
        redirect: "manual",
        credentials: "omit",
      });
      const responseText = method === "HEAD" ? "" : await response.text();
      if (new Blob([responseText]).size > 5 * 1024 * 1024)
        throw Error("回應超過 5 MB 展示限制");
      const resultType = responseText
        ? (() => {
            try {
              JSON.parse(responseText);
              return "json" as const;
            } catch {
              return "text" as const;
            }
          })()
        : ("empty" as const);
      const data: unknown =
        resultType === "json"
          ? JSON.parse(responseText)
          : resultType === "text"
            ? responseText
            : null;
      const headersOut: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        headersOut[k] = v;
      });
      if (controller.signal.aborted) return;
      setResult({
        statusCode: response.status,
        statusText: response.statusText,
        headers: headersOut,
        data,
        type: resultType,
        durationMs: Math.round(performance.now() - t),
        responseBytes: new Blob([responseText]).size,
        itemCount:
          resultType === "json"
            ? Array.isArray(data)
              ? data.length
              : 1
            : resultType === "empty"
              ? 0
              : null,
      });
      setStatus(response.ok ? "success" : "failed");
      if (!response.ok) setError(`外部 API 回傳 HTTP ${response.status}`);
    } catch (e) {
      if (controller.signal.aborted) {
        setStatus("cancelled");
        setError(
          controller.signal.reason === "timeout"
            ? "請求逾時"
            : "已取消等待回應",
        );
      } else {
        setStatus("failed");
        setError(
          (e instanceof Error ? e.message : "請求失敗") +
            "。若是 Failed to fetch，可能是 API CORS 政策或網路問題。",
        );
      }
    } finally {
      clearTimeout(timeout);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };
  return (
    <div className="http-request-editor">
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brandmark">◉</span>
            <b>SyncBoard Pro</b>
            <span className="separator">/</span>
            <Globe2 size={18} color="#6159dc" />
            <span>HTTP Request</span>
          </div>
          <div className="toolbar">
            <span className="saved">
              <CheckCircle2 size={15} />
              {saved}
            </span>
            <button className="icon-button" title="返回畫布" onClick={close}>
              返回畫布
            </button>
          </div>
        </header>
        <div className="panels">
          <aside className="input-panel">
            <div className="panel-heading">
              <b>INPUT</b>
              <div className="tabs">
                <button
                  className={inputTab === "JSON" ? "chosen" : ""}
                  onClick={() => setInputTab("JSON")}
                >
                  JSON
                </button>
                <button
                  className={inputTab === "Schema" ? "chosen" : ""}
                  onClick={() => setInputTab("Schema")}
                >
                  Schema
                </button>
              </div>
            </div>
            <div className="input-content">
              {inputTab === "JSON" ? (
                <>
                  <div className="hint">
                    測試資料（僅用於 Expression 或下方本機篩選）
                  </div>
                  <textarea
                    className="json-editor"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setPage(1);
                    }}
                    spellCheck={false}
                  />
                  <div
                    className={"json-valid " + (parsed.error ? "invalid" : "")}
                  >
                    <span>
                      {parsed.error ? "⚠ Invalid JSON" : "✓ Valid JSON"}
                    </span>
                    <span>{new Blob([input]).size} bytes</span>
                  </div>
                  {parsed.error && <p className="error-text">{parsed.error}</p>}
                </>
              ) : (
                <div className="schema-list">
                  {Object.entries(context).map(([k, v]) => (
                    <div key={k} className="schema-row">
                      <b>{k}</b>
                      <span>{typeof v}</span>
                      <small>{valueText(v)}</small>
                    </div>
                  ))}
                </div>
              )}
              <div className="mapping">
                <div className="section-title">Expression 欄位引用</div>
                {Object.entries(context).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => {
                      setExpression(`{{ $json.${k} }}`);
                      setPreview(true);
                    }}
                  >
                    <span>⠿ {k}</span>
                    <span>{typeof v}</span>
                    <b>{valueText(v)}</b>
                  </button>
                ))}
                <p>
                  按欄位即可預覽 Expression，完整 n8n JavaScript
                  與拖曳尚未實作。
                </p>
              </div>
            </div>
          </aside>
          <section className="center-panel">
            <div className="panel-heading middle">
              <div className="tabs">
                <button
                  className={tab === "Parameters" ? "chosen" : ""}
                  onClick={() => setTab("Parameters")}
                >
                  Parameters
                </button>
                <button
                  className={tab === "Settings" ? "chosen" : ""}
                  onClick={() => setTab("Settings")}
                >
                  Settings
                </button>
              </div>
              <div>
                <button
                  className="execute"
                  disabled={status === "running"}
                  onClick={run}
                >
                  <Play size={14} fill="white" /> Execute step
                </button>
                {status === "running" && (
                  <button className="cancel" onClick={cancel}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
            <div className="config-scroll">
              {tab === "Parameters" ? (
                <>
                  <label>Method</label>
                  <select
                    value={config.method}
                    onChange={(e) =>
                      update({
                        method: e.target.value as HttpMethod,
                        bodyEnabled: ["GET", "HEAD"].includes(e.target.value)
                          ? false
                          : config.bodyEnabled,
                      })
                    }
                  >
                    {(
                      [
                        "GET",
                        "POST",
                        "PUT",
                        "PATCH",
                        "DELETE",
                        "HEAD",
                      ] as HttpMethod[]
                    ).map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                  <label>URL</label>
                  <div className="field-with-icon">
                    <input
                      value={config.url}
                      onChange={(e) => update({ url: e.target.value })}
                    />
                    <button
                      title="Expression 預覽"
                      onClick={() => setPreview(true)}
                    >
                      <Braces size={16} />
                    </button>
                  </div>

                  <Fields
                    title="Query Parameters"
                    values={config.query}
                    onChange={(query) => update({ query })}
                  />
                  <Fields
                    title="Headers"
                    values={config.headers}
                    onChange={(headers) => update({ headers })}
                  />
                </>
              ) : (
                <>
                  <h3>Node Settings</h3>
                  <label>Timeout (ms)</label>
                  <input
                    type="number"
                    min={1000}
                    max={60000}
                    value={config.timeout}
                    onChange={(e) =>
                      update({ timeout: Number(e.target.value) })
                    }
                  />
                  <p className="hint">
                    非敏感設定自動保存在瀏覽器 localStorage。INPUT 和 OUTPUT
                    不保存。
                  </p>
                  <button className="add" onClick={() => update(defaults())}>
                    <RotateCcw size={15} /> 重設為 YouBike 預設
                  </button>
                </>
              )}
            </div>
          </section>
          <section className="output-panel">
            <div className="panel-heading">
              <div className="output-title">
                <b>OUTPUT</b>
                {result && <CheckCircle2 size={17} color="#16a34a" />}
              </div>
              <div className="tabs">
                <button
                  className={outputTab === "Schema" ? "chosen" : ""}
                  onClick={() => setOutputTab("Schema")}
                >
                  Schema
                </button>
                <button
                  className={outputTab === "Table" ? "chosen" : ""}
                  onClick={() => setOutputTab("Table")}
                >
                  Table
                </button>
                <button
                  className={outputTab === "JSON" ? "chosen" : ""}
                  onClick={() => setOutputTab("JSON")}
                >
                  JSON
                </button>
              </div>
            </div>
            <div className="output-content">
              {error && (
                <div className="error-banner">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}
              {status === "running" && (
                <div className="empty">
                  <b>Fetching API…</b>
                  <span>正在等待瀏覽器 fetch() 回應</span>
                </div>
              )}
              {!result && status === "idle" && (
                <div className="empty">
                  <Code2 size={38} color="#b1b6c3" />
                  <b>No output data</b>
                  <span>按 Execute step 取得公開資料</span>
                </div>
              )}
              {result && (
                <>
                  <div className="stats">
                    <strong
                      className={result.statusCode < 300 ? "ok" : "notok"}
                    >
                      {result.statusCode} {result.statusText}
                    </strong>
                    <span>{result.durationMs} ms</span>
                    <span>{result.itemCount ?? "—"} items</span>
                    <span>{(result.responseBytes / 1024).toFixed(1)} KB</span>
                  </div>
                  {result.type === "json" ? (
                    <>
                      {outputTab === "Table" ? (
                        <>
                          <div className="filter">
                            <Search size={15} />
                            <input
                              placeholder="搜尋所有已取得的欄位..."
                              value={search}
                              onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                              }}
                            />
                          </div>
                          <div className="table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  {columns.map((c) => (
                                    <th key={c}>{c}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {visible.map((r, i) => (
                                  <tr key={i}>
                                    {columns.map((c) => (
                                      <td key={c}>{valueText(r[c])}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="pagination">
                            <button
                              disabled={page <= 1}
                              onClick={() => setPage((x) => x - 1)}
                            >
                              ‹
                            </button>
                            <span>
                              {page} / {pageCount}
                            </span>
                            <button
                              disabled={page >= pageCount}
                              onClick={() => setPage((x) => x + 1)}
                            >
                              ›
                            </button>
                            <select
                              value={pageSize}
                              onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setPage(1);
                              }}
                            >
                              {[25, 50, 100].map((x) => (
                                <option key={x}>{x}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      ) : outputTab === "Schema" ? (
                        <div className="schema-list">
                          {columns.map((c) => (
                            <div className="schema-row" key={c}>
                              <b>{c}</b>
                              <span>
                                {Array.isArray(filteredRows[0]?.[c])
                                  ? "array"
                                  : typeof filteredRows[0]?.[c]}
                              </span>
                              <small>{valueText(filteredRows[0]?.[c])}</small>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="json-output">
                          <button
                            className="copy"
                            onClick={() =>
                              void navigator.clipboard.writeText(
                                JSON.stringify(filteredRows, null, 2),
                              )
                            }
                          >
                            <Copy size={14} /> Copy
                          </button>
                          <pre>{JSON.stringify(filteredRows, null, 2)}</pre>
                        </div>
                      )}
                    </>
                  ) : (
                    <pre className="raw-output">
                      {result.type === "text"
                        ? String(result.data)
                        : "（空回應）"}
                    </pre>
                  )}
                  <details className="details">
                    <summary>Response Headers</summary>
                    <pre>{JSON.stringify(result.headers, null, 2)}</pre>
                  </details>
                </>
              )}
            </div>
          </section>
        </div>
        {preview && (
          <div className="modal-mask">
            <div className="modal">
              <button className="modal-x" onClick={() => setPreview(false)}>
                <X />
              </button>
              <h3>
                <Braces size={18} /> Expression Preview
              </h3>
              <p>
                示範版只支援 $json 欄位及陣列索引，不支援執行任意 JavaScript。
              </p>
              <label>Expression</label>
              <input
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
              />
              <label>Result</label>
              <pre className="preview-result">{previewValue}</pre>
              <button className="execute" onClick={() => setPreview(false)}>
                完成
              </button>
            </div>
          </div>
        )}
        {closeDialog && (
          <div className="modal-mask">
            <div className="modal">
              <h3>
                <AlertTriangle /> 正在呼叫 API
              </h3>
              <p>關閉之前先取消等待；外部 API 可能已收到請求。</p>
              <div className="modal-buttons">
                <button onClick={() => setCloseDialog(false)}>繼續測試</button>
                <button
                  className="execute"
                  onClick={() => {
                    cancel();
                    setCloseDialog(false);
                    onClose();
                  }}
                >
                  取消並關閉
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
