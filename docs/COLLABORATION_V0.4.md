# OVERDRIVE V0.4 — 多人協作第一階段

## 本版功能

- 同一 `/workflows/:id` 進入同一個 Yjs 房間。
- 同步新增、刪除、拖曳節點與連線。
- 同步便條紙文字（**編輯完成時**才同步）。
- 使用者在線人數、連線狀態。
- Undo/Redo 改由 Yjs UndoManager 追蹤自己在本分頁的本機操作，不會用整張畫布快照覆蓋其他人的所有修改。
- 節點位置及便條紙 label 分成不同 Yjs 欄位，可降低兩人各自移動和修改文字時互相覆蓋的機率。
- Ctrl+S 保留本機 JSON 備份（**不是共享持久化儲存**）。

## 安裝和啟動

在包含 `pnpm-workspace.yaml` 的專案根目錄：

```powershell
pnpm install
```

開啟 **第一個** PowerShell 終端機啟動協作伺服器：

```powershell
pnpm dev:collab
```

開啟 **第二個** 終端機啟動網站：

```powershell
pnpm dev
```

同一台電腦兩個不同瀏覽器（例如 Chrome 和 Edge）打開 `http://localhost:5173/workflows/demo`。兩個視窗應該顯示 `已連線 · 2 人在線`。測試 A 新增便條紙、拖曳並編輯文字；B 應同步顯示。B 刪除連線，A 應同步。

> 本機模式使用 `ws://127.0.0.1:1234`，不需要網域。若換成另一台電腦進入網站，需要另外設定 Vite `--host`、協作伺服器的監聽位址、防火牆，並提供 `VITE_COLLAB_WS_URL=ws://主機IP:1234`。不能直接把測試伺服器暴露到網際網路。

## 目錄

```text
apps/collaboration/package.json
apps/web/src/features/workflow/collaboration/useCollaborativeWorkflow.ts
apps/web/src/features/workflow/components/WorkflowEditor.tsx
docs/COLLABORATION_V0.4.md
```

## 同步規則

- 每個 workflow ID 是不同房間，例如 `overdrive-demo` 與 `overdrive-123`。
- 節點、連線在 Yjs Map 中以 id 為鍵。
- 本機 `selected`、`dragging` 不同步。
- 同步一張節點的 `x`、`y`、`label` 及其他屬性（base）；不同節點的更新不需要傳整張畫布快照。
- 保留 React Flow 原有拖曳、連線、鍵盤快捷鍵等操作。
- 斷線時 Yjs 可暫存更新，重連後嘗試合併；需另行測試離線衝突邊界。

## 已知限制（正式上線前務必處理）

1. **尚無帳號驗證、房間權限**。所有能連接 WebSocket 的人都可能加入任意工作流程，僅限本機開發環境。
2. **目前協作伺服器資料只存在記憶體**。重啟伺服器後將遺失共享狀態，下一個連線者可能用自己的 `localStorage` 初始化房間。請先保留原始 V0.3 ZIP 和資料備份。
3. 便條紙是完成編輯後同步，不是逐字共享輸入游標；同時編輯同一張便條紙的文字，仍可能發生最後寫入覆蓋。後續可把文字欄位改為 `Y.Text` 實現字元級協作。
4. 此原型對 DAG 僅作前端單次連線檢查；多人並行連線可能產生整體循環。後續需由伺服器驗證，或對此類操作加入鎖／權威校驗。
5. 此原型使用一個 Yjs 欄位儲存 edge；多人同時編輯同一條 edge 的不同屬性可能有衝突。
6. Yjs UndoManager 只追蹤本分頁本地操作，但是多使用者修改同一欄位的複雜 undo 情境仍需要驗收。
7. 尚未實作真正協作游標、使用者身份、權限、PostgreSQL 儲存、操作審計及協作房間 TTL。
8. 本環境無法從 npm 下載依賴，**尚未完成實際 pnpm install、TypeScript 編譯、兩瀏覽器測試**。

## 下一階段建議

- 先完成雙瀏覽器測試、斷線重連測試、Undo/Redo 互不干擾測試。
- 加入多人游標（Awareness: cursor，且游標座標須轉換到畫布座標）。
- 將便條紙文字改為 `Y.Text`，支援同時逐字編輯。
- 將 WebSocket 換成整合驗證的正式服務，落地 Yjs 狀態與 PostgreSQL 工作流程快照，並設置工作空間成員權限。
- 協作儲存完成後再決定 `Ctrl+S` 的意義，例如儲存版本快照。
