# OVERDRIVE 編輯器快捷鍵（V0.2）

| 快捷鍵 | 功能 |
| --- | --- |
| Delete / Backspace | 刪除選取節點或連線；同時刪除與節點相連的連線 |
| Ctrl + A | 全選所有節點 |
| Ctrl + C | 複製選取的節點及它們之間的連線 |
| Ctrl + V | 貼上複製的節點（逐次偏移 48px，建立新 ID）|
| Ctrl + Z | 復原最近一次圖形變更 |
| Ctrl + Shift + Z | 重做 |
| Ctrl + S | 儲存至目前瀏覽器 localStorage |
| Escape | 清除節點與連線選取狀態 |

Mac 亦支援 Cmd 對應 Ctrl 的組合。

## 修改的檔案

- `apps/web/src/features/workflow/components/WorkflowEditor.tsx`
- `apps/web/src/styles/global.css`

## 注意事項

- 複製貼上使用編輯器的記憶體剪貼簿，不會寫入作業系統剪貼簿。重新整理頁面後剪貼簿清空。
- Undo/Redo 最多保留 100 次圖形變更，重新整理後歷史記錄清空。
- 拖曳節點記為一次復原步驟，選取和取消選取不產生復原記錄。
- 輸入框、下拉選單、文字編輯區取得焦點時不攔截快捷鍵，避免破壞正常輸入。
- 儲存仍屬於瀏覽器本地草稿，不代表已寫入後端或多人同步。
- 尚未涵蓋未來新增的節點參數表單內容修改之復原；這部分應統一走圖形狀態操作層。

## 替換方式

將 `WorkflowEditor.tsx` 覆蓋同一路徑的原檔，並在 `global.css` 加上：

```css
.flow-toolbar button:disabled { opacity: .4; cursor: not-allowed; }
```

建議先備份原檔，然後從專案根目錄執行 `pnpm install`、`pnpm dev`，確認快捷鍵可用再提交 Git。
