# 路由與頁面對照表

| 網址 | 頁面檔案 | 用途 | 側邊欄 |
|---|---|---|---|
| `/` | `app/App.tsx` 轉址 | 自動轉 `/dashboard` | 否 |
| `/dashboard` | `pages/DashboardPage.tsx` | 工作空間總覽 | 是 |
| `/workflows` | `pages/WorkflowsPage.tsx` | 流程列表 | 是 |
| `/workflows/:id` | `pages/WorkflowPage.tsx` | 指定流程編輯器 | 列表入口 |
| `/settings` | `pages/SettingsPage.tsx` | 設定 | 是 |
| `/profile` | `pages/ProfilePage.tsx` | 個人資料 | 是 |
| 其他路徑 | `pages/NotFoundPage.tsx` | 404 | 否 |

## 連結機制

- `src/main.tsx`：用 `<BrowserRouter>` 包住 `<App>`。
- `src/app/App.tsx`：使用 `<Routes>` 和 `<Route>` 定義網址對應頁面。
- `src/app/routes.ts`：存放共用路由常數 `ROUTES`。新增頁面時先在這裡加入路徑。
- `src/components/layout/AppLayout.tsx`：側邊欄 `<NavLink>`；`<Outlet>` 顯示子頁面。
- `src/pages/WorkflowsPage.tsx`：`<Link to={ROUTES.workflow('demo')}>` 導航到 `/workflows/demo`。
- `src/pages/WorkflowPage.tsx`：`useParams()` 取得網址內的 `id`。

## 新增頁面的步驟（示例：團隊頁）

1. 建立 `src/pages/TeamPage.tsx`，預設匯出 React 元件。
2. 在 `src/app/routes.ts` 加上 `team: '/team'`。
3. 在 `src/app/App.tsx` 匯入 `TeamPage`，加入 `<Route path={ROUTES.team} element={<TeamPage />} />`。
4. 在 `src/components/layout/AppLayout.tsx` 的 `nav` 陣列加入連結；選擇合適 Lucide 圖示。
5. 開啟 `http://localhost:5173/team` 測試直接進入頁面與導覽。

## 部署注意

BrowserRouter 的 SPA 在正式部署時需要設定 fallback：所有不是靜態資源的路徑應回傳 `index.html`，否則重整 `/settings` 等路徑可能產生伺服器端 404。
