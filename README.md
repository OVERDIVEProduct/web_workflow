# OVERDRIVE Starter — 多頁面前端骨架 v0.1

此專案是**全新開發起點**，不是既有 OVERDRIVE GitHub 專案的原地修改。已分離頁面、導覽 Layout、React Flow 編輯器，並預留 API / Worker / Collaboration / Shared Packages。

## 需求

- Windows / macOS / Linux
- Node.js：請用團隊統一且與 Vite 8、TypeScript 6 相容的版本；建議 Node.js 24 LTS
- pnpm：本專案 packageManager 宣告 `pnpm@12.21.0`，請統一版本

## 安裝啟動

在新專案的根目錄執行：

```powershell
pnpm install
pnpm dev
```

然後開啟 http://localhost:5173 ，首頁將跳轉 `/dashboard`。

### 檢查

```powershell
pnpm check
pnpm build
```

## 各頁面網址

| URL | 說明 |
|---|---|
| `/` | 自動前往 `/dashboard` |
| `/dashboard` | 工作空間總覽 |
| `/workflows` | 工作流程列表 |
| `/workflows/demo` | 示範 React Flow 編輯器 |
| `/settings` | 設定頁 |
| `/profile` | 個人檔案 |
| 其他網址 | 404 頁 |

**完整路由檔案與新增頁面教學：`docs/ROUTING.md`**。

## 路由與程式入口

1. `apps/web/src/main.tsx` 建立 BrowserRouter
2. `apps/web/src/app/App.tsx` 宣告 Routes
3. `apps/web/src/app/routes.ts` 管理共用 URL
4. `apps/web/src/components/layout/AppLayout.tsx` 提供左側導覽列及 Outlet
5. `apps/web/src/pages/*` 是每個獨立頁面
6. `apps/web/src/features/workflow/*` 是工作流程編輯器元件

## 現階段已具備

- Dashboard、工作流程列表、設定頁、個人檔案頁及 404
- 左側導覽列和所有路由
- React Flow 五類節點的簡易視覺化畫布與新增操作
- 禁止新連線形成循環（前端示範驗證）
- 以 localStorage 儲存工作流程示範草稿、個人顯示名稱與主題偏好

## 尚未實作（不得當作已完成）

- 登入、後端資料庫、真正的工作流程 CRUD
- 多人協作、存取權限、角色管理
- HTTP Request 執行器及工作流程引擎
- 設定頁真正的整站主題切換

localStorage 只用於個人開發測試，不是安全且可靠的多人資料儲存方式。

## Git 與團隊使用建議

**不要覆蓋舊專案**。可先解壓至 `C:\Users\user\Desktop\OVERDRIVE-v2`，在新資料夾驗證成功後，再以新的 feature 分支導入 GitHub 或由全隊決議新的 repo。

不要提交 `.env`、Token 或 `node_modules`。初期只需 `pnpm install` 還原依賴。

## V0.4 多人即時協作（實驗版）

詳見 `docs/COLLABORATION_V0.4.md`。先 `pnpm install`，再分別執行 `pnpm dev:collab` 與 `pnpm dev`。
