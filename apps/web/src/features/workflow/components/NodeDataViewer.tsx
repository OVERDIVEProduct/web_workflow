import { useMemo, useState } from "react";
export type ViewerItem = { json: Record<string, unknown> };
type View = "JSON" | "Table" | "Schema";
const pretty = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
const typeName = (v: unknown) =>
  v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
export default function NodeDataViewer({
  items,
  emptyText,
}: {
  items: ViewerItem[] | null;
  emptyText: string;
}) {
  const [view, setView] = useState<View>("JSON");
  const [page, setPage] = useState(0);
  const fields = useMemo(
    () =>
      Array.from(
        new Set(
          (items || []).slice(0, 200).flatMap((i) => Object.keys(i.json || {})),
        ),
      ),
    [items],
  );
  const rows = (items || []).slice(page * 50, (page + 1) * 50);
  return (
    <div className="ns-viewer">
      <div className="ns-viewtabs">
        {(["JSON", "Table", "Schema"] as View[]).map((v) => (
          <button
            key={v}
            className={view === v ? "active" : ""}
            onClick={() => setView(v)}
          >
            {v}
          </button>
        ))}
        <span>{items?.length ?? 0} Items</span>
      </div>
      {!items ? (
        <p className="ns-empty">{emptyText}</p>
      ) : items.length === 0 ? (
        <p className="ns-empty">執行成功，沒有輸出資料（0 Items）。</p>
      ) : (
        <>
          {view === "JSON" && (
            <pre className="ns-json">{JSON.stringify(rows, null, 2)}</pre>
          )}
          {view === "Table" && (
            <div className="ns-table-scroll">
              <table>
                <thead>
                  <tr>
                    {fields.map((f) => (
                      <th key={f}>{f}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {fields.map((f) => (
                        <td key={f}>{pretty(r.json?.[f]) ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {view === "Schema" && (
            <div className="ns-schema">
              {fields.map((f) => (
                <div key={f}>
                  <strong>{f}</strong>
                  <span>
                    {Array.from(
                      new Set(
                        (items || [])
                          .slice(0, 200)
                          .map((i) => typeName(i.json?.[f])),
                      ),
                    ).join(" | ")}
                  </span>
                </div>
              ))}
            </div>
          )}
          {items.length > 50 && (
            <div className="ns-pagination">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                上一頁
              </button>
              <span>
                {page + 1} / {Math.ceil(items.length / 50)}（每頁 50 筆）
              </span>
              <button
                disabled={(page + 1) * 50 >= items.length}
                onClick={() => setPage((p) => p + 1)}
              >
                下一頁
              </button>
            </div>
          )}
          {items.length > 200 && (
            <small className="ns-limit">
              欄位結構以最多 200 筆資料分析；完整輸入資料不會因此變更。
            </small>
          )}
        </>
      )}
    </div>
  );
}
