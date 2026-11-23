# OVERDRIVE — Workflow Platform

> **目前開發基準：V0.4 多人即時協作版**（後續持續加入 HTTP Request 編輯器等功能）  
> GitHub：<https://github.com/OVERDIVEProduct/web_workflow>

OVERDRIVE 是以 **React Flow** 製作的視覺化工作流程編輯器。現階段可新增、拖曳、連接及刪除節點，使用便條紙註解畫布，並透過 **Yjs + WebSocket** 在同一個工作流程房間中同步多個瀏覽器的畫布變更。

本文件以目前 GitHub 倉庫中的 **npm Workspaces** 設定為準。初次安裝請使用 **npm**，不要混用舊版教學中的 pnpm 指令。

## 1. 專案目前有哪些功能？

| 項目 | 目前狀態 |
| --- | --- |
| 多頁面路由、側邊導覽 | 已具備 |
| React Flow 畫布、節點增刪、拖曳與連線 | 已具備 |
| Manual Trigger、HTTP Request、Set、IF、Output、便條紙 | 已具備節點 UI／基礎操作，部分節點仍為示範用途 |
| 便條紙雙擊編輯與完成編輯後同步 | 已具備 |
| 多瀏覽器畫布變更即時同步 | 已具備（需啟動協作伺服器） |
| 在線人數、連線狀態 | 已具備 |
| 復原／重做、複製／貼上等快捷鍵 | 已具備基礎功能，複雜多人衝突情境仍需驗證 |
| `Ctrl + S` 本機草稿備份 | 已具備；不是共享資料庫儲存 |
| 協作資料永久保存、正式登入與權限控制 | 尚未完成 |
| 完整工作流程執行引擎 | 尚未完成 |

> **注意**：畫布上顯示 HTTP Request 等節點，不代表完整自動化流程執行引擎已完成。請依實際功能進度測試。

## 2. 事前準備

請先在組員自己的 Windows、macOS 或 Linux 電腦準備：

- **Git**：可在終端機執行 `git --version`。
- **Node.js**：建議團隊統一使用 Node.js **24 LTS**（或已確認與 Vite 8 相容的版本）。
- **npm**：根目錄 `package.json` 宣告 `npm@11.19.1`；請以團隊實際採用的版本為準。
- **VS Code / Antigravity IDE** 或其他可開啟終端機的編輯器。

在 PowerShell 檢查：

```powershell
node -v
npm -v
git --version
```

不需要 Docker、外部網域或雲端伺服器，就能在**同一台電腦**完成雙瀏覽器同步測試。

## 3. 從 GitHub Clone 到自己的電腦

### 步驟 1：Clone 正式開發倉庫

在打算存放專案的位置開啟 PowerShell：

```powershell
cd $HOME\Desktop
git clone https://github.com/OVERDIVEProduct/web_workflow.git
cd web_workflow
```

檢查目前所在分支及遠端來源：

```powershell
git branch --show-current
git remote -v
```

預期分支為 `main`，`origin` 指向 `https://github.com/OVERDIVEProduct/web_workflow.git`。

> 如果團隊最新功能尚未合併至 `main`，請先向組長確認應測試哪一個分支，切勿直接假設每個功能都已在 `main`。

### 步驟 2：安裝相同版本的依賴

在**專案根目錄**（可看到 `package.json`、`package-lock.json`、`apps/` 的位置）：

```powershell
npm ci
```

`npm ci` 會依據已提交的 `package-lock.json` 安裝套件，避免各組員自行解析出不同版本。不要手動升級 Yjs 或協作伺服器。

目前主要相依套件：

| 所在位置 | 套件 | 用途 |
| --- | --- | --- |
| `apps/web` | `@xyflow/react` `13.0.1` | 節點畫布 |
| `apps/web` | `yjs` `^13.6.0` | 共享文件與資料合併 |
| `apps/web` | `y-websocket` `^3.0.0` | 前端同步連線 |
| `apps/collaboration` | `@y/websocket-server` **`0.1.1`** | 協作伺服器 |

**重要**：我們曾遇到「在線人數正常、節點卻不同步」的問題，修正方式是將伺服器的 `@y/websocket-server` 固定為 `0.1.1`。請保留 `package-lock.json`，不要任意更改此版本。

## 4. 在本機啟動兩個服務

多人協作需要同時執行 **WebSocket 協作伺服器**及 **React 前端**。這是不同的程序，因此請開啟 **兩個終端機**，並且都保持開啟。

### 終端機 A：啟動協作伺服器

```powershell
cd $HOME\Desktop\web_workflow
npm run dev:collab
```

成功時終端機通常顯示：

```text
running at 'localhost' on port 1234
```

協作伺服器位址為 `ws://localhost:1234`，這是 **WebSocket** 服務，不是一般網頁；直接在瀏覽器網址列輸入 `http://localhost:1234` 並不會顯示 OVERDRIVE 網站。

### 終端機 B：啟動 React 前端

```powershell
cd $HOME\Desktop\web_workflow
npm run dev
```

目前 `apps/web/package.json` 中的 Vite 啟動設定為 `vite --host 127.0.0.1`。正常會顯示類似：

```text
Local: http://127.0.0.1:5173/
```

開啟網站：<http://127.0.0.1:5173/>。

> 若 5173 或 1234 被其他程式佔用，實際啟動位址可能不同或啟動失敗。請以終端機的訊息為準。**前端開啟成功，不代表 WebSocket 也已成功連線。**

### 第一次啟動可先驗證編譯

```powershell
npm run check
npm run build
```

以上是額外的檢查指令；它們不會取代前述兩個開發服務。

## 5. 在同一台電腦測試「雙瀏覽器／多視窗同步」

本節是所有組員 Clone 後必須完成的驗收流程。

### 步驟 1：確認兩個服務都正在執行

- 終端機 A：`npm run dev:collab`，WebSocket Port **1234**。
- 終端機 B：`npm run dev`，React 前端 Port **5173**。

### 步驟 2：開啟相同的工作流程

在 **Chrome** 與 **Edge**（或同一瀏覽器的兩個視窗）分別開啟**完全相同**的網址：

```text
http://127.0.0.1:5173/workflows/demo
```

請保持兩個視窗的工作流程 ID 都為 `demo`。本專案會把它轉成 Yjs 房間名稱 `overdrive-demo`。

- `/workflows/demo` 與 `/workflows/test` **不是同一個房間**，畫布不會互相同步。
- Chrome／Edge 的兩個獨立視窗，即使在同一台電腦上，也會各自建立連線。
- 畫布上可能各自使用不同的縮放或捲動位置；這不代表節點資料不同步。

### 步驟 3：等待連線完成

應先看到「**已連線**」與相對應的在線人數，例如 `2 人在線`。只有顯示人數並不足以證明內容已同步，仍須做下面的實際測試。

### 步驟 4：測試資料同步

| 操作 | 預期結果 |
| --- | --- |
| 視窗 A 新增「便條紙」 | 視窗 B 自動出現同一張便條紙 |
| 視窗 A 拖曳便條紙到其他位置 | 視窗 B 看到節點位置改變 |
| 視窗 B 雙擊便條紙，修改文字並結束編輯 | 視窗 A 看到更新後文字 |
| 視窗 A 新增連線 | 視窗 B 顯示相同連線 |
| 視窗 B 刪除節點或連線 | 視窗 A 顯示相同刪除結果 |
| 保持協作伺服器執行，只重新整理其中一個視窗 | 正常情況應重新取得共享房間狀態 |

**便條紙文字在「完成編輯」後同步**，目前不是逐字共同輸入的編輯器。`Ctrl + S` 是本機備份，不是儲存到共享資料庫。

### 步驟 5：如果想測試新的、乾淨的房間

可把兩個瀏覽器的網址都改成：

```text
http://127.0.0.1:5173/workflows/team-test-001
```

只要兩邊使用相同 ID，就會加入同一個房間。若本機已有該 ID 的舊草稿，初次初始化可能使用本機備份資料；請注意不要在正式工作流程房間進行破壞性測試。

## 6. 同一台電腦正常，為什麼不同組員的電腦不會同步？

**`localhost` 指的是每位組員自己的電腦。**

若 A、B 各自 Clone 後，都在自己的電腦啟動 `npm run dev:collab`，他們其實連的是**兩台不同的 WebSocket Server**；即使開啟同樣的 `/workflows/demo`，也不會自動共享畫布。

跨電腦協作需要：

1. 選定一台**共用**的協作伺服器，並讓它持續運作。
2. 所有組員的 React 前端，使用**相同的 WebSocket Server 位址**。
3. 所有組員進入**相同的工作流程 ID**。
4. 伺服器的監聽介面、防火牆與網路路由必須允許組員連線。

### 本地前端連線設定

前端程式的協作網址設定位置：

```text
apps/web/src/features/workflow/collaboration/useCollaborativeWorkflow.ts
```

目前預設：

```typescript
const serverUrl =
  import.meta.env.VITE_COLLAB_WS_URL || 'ws://localhost:1234';
```

如需讓多台電腦連到同一個協作伺服器，可在每位組員的本機建立：

```text
apps/web/.env.local
```

填入（**僅為範例 IP，請換成實際的伺服器位址**）：

```dotenv
VITE_COLLAB_WS_URL=ws://192.168.1.100:1234
```

儲存後要**重新啟動** `npm run dev` 才會讀取環境變數。

> 這只是前端設定。共用 WebSocket Server 預設顯示 `running at 'localhost'`，不保證接受其他電腦的連線；需要另行調整伺服器監聽、網路與防火牆。**請勿把目前沒有登入／權限控制的開發版 WebSocket 直接公開至網際網路**。跨外網開發建議走可信任 VPN／私人網路，並在正式上線前加入驗證與 WSS。

## 7. 常見問題排查

### 7.1 網頁白畫面

先開瀏覽器 `F12 → Console`，再執行：

```powershell
npm run check
npm run build
```

我們曾遇過 React Flow 13 的 API 變更：舊版 `applyEdgeChanges`、`applyNodeChanges` 匯入會造成白畫面，需使用相容的 Changeset 寫法。**現有版本已修正，請不要把舊版程式碼覆蓋回去。**

### 7.2 新增節點按鈕呈灰色，畫面顯示「等待首次同步」

這代表協作文件還沒完成首次同步。先檢查：

```powershell
Test-NetConnection localhost -Port 1234
Test-NetConnection 127.0.0.1 -Port 1234
```

如果只有其中一個位址能連線，可檢查 `VITE_COLLAB_WS_URL` 是否與實際監聽位址一致。接著打開瀏覽器 `F12 → Network → WS`，確認 WebSocket 已連線並完成 Yjs 初始同步。**不要直接移除 `disabled={!ready}`**，以免在尚未同步時編輯或覆蓋共享狀態。

### 7.3 在線人數正常，但新增節點不同步

請先確認兩個視窗連的是：

- **同一個 WebSocket Server**：例如 `ws://localhost:1234`。
- **同一個房間**：例如 `overdrive-demo`。
- **相容的 Yjs 版本**：`apps/collaboration/package.json` 中 `@y/websocket-server` 必須保持 `0.1.1`。

接著在 A 新增一張便條紙，檢查 A、B 的 `F12 → Console`：

```text
[Yjs] 發布節點: ...
[Yjs] 文件更新: ...
[Yjs] 收到共享畫布: ...
```

A 有「發布」但 B 沒「文件更新」時，代表資料尚未正確傳到 B 的 Y.Doc。**只顯示在線人數，不等於節點已同步。**

### 7.4 重新整理後節點恢復舊狀態／消失

目前協作服務**沒有永久儲存**：

- **僅重新整理頁面，伺服器未重啟**：正常情況應重新同步尚在記憶體中的房間資料。
- **協作伺服器關閉／重啟**：共享資料可能遺失；新房間可能由第一位使用者的預設畫布或 localStorage 草稿重新初始化。
- **`Ctrl + S`**：只在**當前瀏覽器**存放本機草稿備份，不代表其他組員也已保存。

請不要把開發版 WebSocket 記憶體當作正式資料庫。真正的多人持久化仍待後續開發。

### 7.5 `npm ci` 失敗或找不到套件

確認是在根目錄、Node.js 與 npm 版本符合團隊要求，且有網路可連線 npm registry：

```powershell
node -v
npm -v
npm config get registry
```

不要任意移除 `package-lock.json` 或升級 `@y/websocket-server`。若需修改套件，應由負責人建立分支、測試後再合併。

## 8. 頁面網址與檔案位置

| URL | 頁面 | 用途 |
| --- | --- | --- |
| `/` | 自動導向 `/dashboard` | 首頁入口 |
| `/dashboard` | `DashboardPage.tsx` | 工作空間總覽 |
| `/workflows` | `WorkflowsPage.tsx` | 工作流程列表 |
| `/workflows/:id` | `WorkflowPage.tsx` | 指定工作流程的多人協作編輯器 |
| `/settings` | `SettingsPage.tsx` | 設定頁 |
| `/profile` | `ProfilePage.tsx` | 個人檔案 |
| 其他 | `NotFoundPage.tsx` | 404 |

主要開發檔案：

```text
apps/
├── web/
│   └── src/
│       ├── main.tsx
│       ├── app/
│       │   ├── App.tsx
│       │   └── routes.ts
│       ├── components/layout/AppLayout.tsx
│       ├── pages/
│       └── features/workflow/
│           ├── components/WorkflowEditor.tsx
│           ├── collaboration/useCollaborativeWorkflow.ts
│           ├── nodes/
│           └── types/workflow.ts
└── collaboration/
    └── package.json
```

- `WorkflowEditor.tsx`：React Flow 畫布互動，節點與連線變更時呼叫同步功能。
- `useCollaborativeWorkflow.ts`：Y.Doc、`WebsocketProvider`、Awareness、節點資料發佈與接收、Yjs UndoManager。
- `apps/collaboration/package.json`：WebSocket Server 套件和啟動指令。
- `docs/ROUTING.md`：新增頁面、導覽列與 URL 的詳細說明。
- `docs/COLLABORATION_V0.4.md`：協作資料模型、同步規則與限制。

## 9. Git 團隊合作基本規範

取得最新穩定版：

```powershell
git switch main
git pull --ff-only origin main
npm ci
```

新增功能時建立自己的分支：

```powershell
git switch -c feature/your-feature-name
```

完成後先測試：

```powershell
npm run check
npm run build
```

再檢查檔案差異，確認沒有 `.env`、Token、帳號密碼、憑證、`node_modules` 或本機資料庫被提交，接著 Commit / Push 到功能分支並以 Pull Request 合併進 `main`。

```powershell
git status
git add -A
git diff --cached --name-only
git commit -m "feat: 描述新增功能"
git push -u origin feature/your-feature-name
```

**切勿直接 Push 敏感資料或使用 `git push --force` 覆蓋共享的 `main`。**

## 10. 新組員快速驗收清單

- [ ] `git clone` 後確認分支是 `main`
- [ ] `npm ci` 完成且沒有安裝錯誤
- [ ] 終端機 A 的 `npm run dev:collab` 正在監聽 Port `1234`
- [ ] 終端機 B 的 `npm run dev` 正在提供前端 Port `5173`
- [ ] Chrome 與 Edge 都能開啟 `/workflows/demo`
- [ ] 兩個視窗顯示已連線與在線人數
- [ ] A 新增便條紙，B 立即出現
- [ ] B 拖曳或修改便條紙，A 更新
- [ ] A 新增／刪除連線，B 更新
- [ ] 保持 WebSocket Server 運作時，重新整理仍可取得共享畫布

全部通過後，即代表**該組員已能在本機重現 V0.4 的多視窗協作功能**。不同電腦跨網路協作，請另依第 6 節連接同一台共享伺服器。

---

**版本備註**：本 README 依 `OVERDIVEProduct/web_workflow` 現有程式與 V0.4 協作說明更新。專案持續開發，後續功能完成時應同步修訂本文件。
