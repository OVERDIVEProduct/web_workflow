# OVERDRIVE Merged

獨立合併專案：以 `web_workflow_Node_20261126/web_workflow-main` 作為功能、Workflow Engine、API 與協作基底，整合 `web_workflow` 的 UI、UX、SVG 與樣式。兩個原始專案未修改。

## 環境需求

- Node.js `^20.19.0` 或 `>=22.12.0`（符合 Vite 8 engine range）
- npm（保留 npm Workspaces 與 `package-lock.json`；不使用 pnpm/yarn）

## 安裝

在 `OVERDRIVE_Merged` 專案根目錄執行：

```powershell
npm ci
```

## 啟動

開三個終端機，工作目錄都設為 `OVERDRIVE_Merged` 根目錄：

```powershell
# 終端機 1：Yjs / y-websocket（預設 localhost:1234）
npm run dev:collab
```

```powershell
# 終端機 2：Node.js Execution API（預設 127.0.0.1:3001）
$env:API_PORT = '3001'
npm run dev:api
```

若執行環境限制 `node --watch` 建立子程序並回報 `spawn EPERM`，以以下命令直接啟動同一支 API server：

```powershell
$env:API_PORT = '3001'
node apps/api/src/server.js
```

```powershell
# 終端機 3：Vite 前端（預設 127.0.0.1:5173；/api 代理到 3001）
npm run dev
```

開啟 `http://127.0.0.1:5173/workflows/demo`。若 Vite 預設埠不適用，可明確指定：

```powershell
npm run dev --workspace=web -- --port 5173 --strictPort
```

API 使用 `API_PORT` 環境變數；協作服務依 y-websocket 預設埠 1234。若需更換協作 URL，前端可用 `VITE_COLLAB_WS_URL` 覆寫。Vite `/api` proxy 指向 `http://127.0.0.1:3001`，更換 API 埠時需同步調整 `apps/web/vite.config.ts` proxy。

## 驗證

```powershell
npm run check
npm run build
npm run test:engine
npm ls --workspaces --depth=0
```

Engine 測試使用 Node.js test runner。若執行環境限制子程序啟動並回報 `spawn EPERM`，請在允許 Node 子程序的本機環境執行，不要略過或刪除測試。

## 主要路由

| URL | 頁面 |
|---|---|
| `/dashboard` | 首頁 |
| `/workflows` | 工作流程列表 |
| `/workflows/demo` | React Flow 工作流程白板 |
| `/settings` | 設定 |
| `/profile` | 個人檔案 |
| 其他路徑 | 404 |

Workflow Run 與 Step API 位於 `apps/api`，執行引擎與原有測試位於 `apps/worker`；Yjs workflow room 使用 workflow ID 隔離。執行 API 為本機示範服務，執行記錄保存在 API process 記憶體中。
