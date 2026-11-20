# OVERDRIVE V0.3：便條紙節點

以 V0.2 Shortcuts 為基礎，新增 Miro 風格便條紙（Sticky Note）。

## 操作方式

1. 在 `/workflows/demo` 點選左上方 **便條紙**，即可新增。
2. 按住便條紙本體拖拉移動。
3. 雙擊便條紙文字進入編輯；點擊其他位置或 `Ctrl+Enter` 完成編輯；`Esc` 取消當次編輯。
4. 從便條紙右側圓點拉到另一張便條紙左側圓點，即可建立連線。
5. 便條紙支援原有 Delete、Ctrl+A、Ctrl+C/V、Ctrl+Z、Ctrl+Y、Ctrl+S、Esc 操作；文字編輯模式的按鍵不會刪除節點。
6. 按 **儲存草稿** 將文字、位置、連線寫入瀏覽器 localStorage。

## 修改檔案

- `apps/web/src/features/workflow/types/workflow.ts`：加入 `stickyNote` 節點類型
- `apps/web/src/features/workflow/nodes/StickyNoteNode.tsx`：便條紙 UI、雙擊編輯與 Handle
- `apps/web/src/features/workflow/nodes/StickyNoteActions.tsx`：呼叫 Editor 更新文字
- `apps/web/src/features/workflow/components/WorkflowEditor.tsx`：註冊節點、加入新增按鈕、文字編輯歷史、Ctrl+Y
- `apps/web/src/styles/global.css`：便條紙樣式

## 注意

- 目前工作流程沿用 DAG 規則，無法新增形成循環的連線，與純 Miro 白板自由連線不同。
- 現在的連線方向固定從右（source）到左（target）。若要任意邊連接、無方向及隨節點自動選擇端點，需再擴充。
- 此版依然使用 localStorage，尚未實作多人同步與後端儲存。
- 此檔案為基於原 V0.2 完整專案的修改版本；未在使用者電腦上驗證瀏覽器互動。
