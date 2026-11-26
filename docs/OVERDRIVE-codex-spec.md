# OVERDRIVE 給 Codex 的介面實作規格

版本：0.2 草稿  
更新日期：2026-11-26  
適用對象：依使用者要求實作或維護 OVERDRIVE 介面的 Codex

本文件將設計數值、已確認覆寫、元件狀態與驗收條件整理為可執行的實作依據。只有在使用者要求實作時才執行程式或設計修改；讀取本文件本身不授權建立網站、修改 Figma、發布或更換專案架構。

人類閱讀版：[OVERDRIVE 介面樣式規格書](./OVERDRIVE-style-spec.md)。兩份文件描述同一版規格，後續修改應同步維護。

## 1 執行約束

1. 遵守適用的上層指令、使用者最新要求與專案規則。本文件提供樣式參考，不覆寫 AGENTS.md 或技能的適用要求。
2. **節點卡片說明一律使用 12px。**此項已由使用者確認，優先於 Figma 中原有的 13px，適用於元件與所有實例。
3. 說明行高維持 19.5px，字距維持 0；不得因字級改為 12px 而自動改為 18px 行高、400 字重或其他卡片高度。
4. 除上述字級外，保留本文件的來源數值。不自動統一黃色、不將全部間距四捨五入為 4／8px 倍數、不全面增加陰影。
5. 先查看現有框架、元件與 tokens；沿用專案慣例。未指定框架，不預設 React、Vue、Tailwind 或其他依賴。
6. token 名稱是本文件提出的實作命名，不代表 Figma 已存在同名 Variables；有既有對應 token 時沿用既有名稱。
7. `referenceSizePx` 表示來源元件尺寸，不等於已核定的響應式限制。沒有依據時，不自動加入斷點、動畫、文字截斷或狀態語意。
8. 不將本文件列為建議的事項當成核定變更。只影響特定功能的未決事項，不妨礙其他已明確部分的實作。

## 2 來源定位

Figma 檔案：[OVERDRIVE 網站設計](https://www.figma.com/design/asSuQYRvW3FzgghTY7LuQS)。

| 用途 | 節點 ID |
|---|---|
| color 空白參考區 | `14:193` |
| button 參考區 | `14:208` |
| icon 參考區 | `14:215` |
| nav 參考區 | `18:718` |
| cards 參考區 | `91:630` |
| 導覽按鈕 btn-btn | `18:341` |
| 次要按鈕 btn-text | `18:1207` |
| 工具列按鈕 btn-tool | `48:535` |
| 圖示按鈕 btn-icon | `98:332` |
| 密碼輸入框 input-icon | `132:4247` |
| 一般輸入框 input | `137:4279` |
| 主要按鈕 button | `156:4378` |
| Sidebar | `18:838` |
| top-nav | `34:1786` |
| 工具面板 | `59:884` |
| 樣式面板 | `62:1993` |
| n8n-card | `18:621` |
| sticky-note | `145:780` |
| line-type | `98:447` |
| front-arrow | `98:525` |
| back-arrow | `98:532` |
| shape | `116:1200` |

需要重新查閱 Figma 時使用可用的 Figma 工具，先遵循相關技能。不把本次建立文件視為修改設計檔的授權。

## 3 資料約定

- JSON 中所有以 `Px` 結尾的數值單位為 px，`referenceSizePx` 順序為寬、高。
- `paddingPx` 順序為上、右、下、左。
- `lineHeightPercent: 140` 對應 CSS `line-height: 1.4`。
- `lineHeight: "auto"` 對應自然行高，Web 可使用 `normal`，不自行推定固定 px。
- `letterSpacingEm: 0.12` 對應 Figma 12% 字距，不是 12px。
- `null` 邊框表示無可見邊框，不是透明的 1px 邊框。
- 變體名稱僅描述已觀察到的狀態；`unresolved` 不代表可以自動決定業務意義。

## 4 色彩資料

```json
{
  "colors": {
    "surface": "#FFFFFF",
    "text-primary": "#444445",
    "surface-subtle": "#F5F5F5",
    "surface-active": "#E8E8E9",
    "input-border-hover": "#DBDBE0",
    "text-placeholder": "#BCBCC9",
    "search-border": "#DFE3E8",
    "accent": "#EDE186",
    "accent-hover": "#DFD16A",
    "primary-pressed": "#E6D33F",
    "secondary-hover-bg": "#F8EEA8",
    "secondary-pressed-bg": "#F5E677",
    "secondary-interaction-text": "#CAB935",
    "icon-focus-bg": "#F5DF73",
    "note-bg": "#FFF2A8",
    "note-text": "#625629",
    "version-text": "#325FE6"
  },
  "referenceOnly": {
    "showcase-nav-and-cards-bg": "#F0F0F0",
    "showcase-buttons-bg": "#F6F6F6"
  }
}
```

`referenceOnly` 不應自動映射為全域頁面或中央畫布底色。Figma 元件集的 `#9747FF` 紫色虛線邊框不得輸出到產品。

## 5 文字資料

```json
{
  "typography": {
    "topbar-title": {
      "family": "Noto Sans TC", "weight": 700,
      "fontSizePx": 16, "lineHeightPercent": 140, "letterSpacingEm": 0
    },
    "sidebar-item": {
      "family": "Noto Sans TC", "weight": 400,
      "fontSizePx": 16, "lineHeightPercent": 140, "letterSpacingEm": 0.12
    },
    "panel-title": {
      "family": "Noto Sans TC", "weight": 400,
      "fontSizePx": 16, "lineHeightPx": 27, "letterSpacingEm": 0.12
    },
    "editor-section-title": {
      "family": "Noto Sans TC", "weight": 500,
      "fontSizePx": 14, "lineHeight": "auto", "letterSpacingEm": 0.12
    },
    "node-card-title": {
      "sourceFamilies": ["Noto Sans TC", "Inter"], "weight": 400,
      "fontSizePx": 18, "lineHeightPx": 24, "letterSpacingEm": 0
    },
    "node-card-description": {
      "fontSizePx": 12, "lineHeightPx": 19.5, "letterSpacingEm": 0,
      "sourceFontOptions": [
        {"family": "Noto Sans TC", "weight": 100},
        {"family": "Inter", "weight": 200}
      ],
      "fontSizeStatus": "user-confirmed-override"
    },
    "input": {
      "family": "Noto Sans TC", "weight": 400,
      "fontSizePx": 12, "lineHeight": "auto", "letterSpacingEm": 0
    },
    "panel-description": {
      "family": "Noto Sans TC", "weight": 400,
      "fontSizePx": 12, "lineHeightPx": 18, "letterSpacingEm": 0
    },
    "node-category": {
      "family": "Inter", "weight": 400,
      "fontSizePx": 12, "lineHeightPx": 15, "letterSpacingEm": 0
    },
    "primary-button": {
      "family": "Inter", "weight": 400,
      "fontSizePx": 18, "lineHeight": "auto", "letterSpacingEm": 0.12
    },
    "secondary-button": {
      "family": "Inter", "weight": 500,
      "fontSizePx": 18, "lineHeight": "auto", "letterSpacingEm": 0.12
    },
    "sticky-note": {
      "family": "Noto Sans TC", "weight": 400,
      "fontSizePx": 14, "lineHeight": "auto", "letterSpacingEm": 0
    },
    "version-label": {
      "family": "Noto Sans TC", "weight": 700,
      "fontSizePx": 13, "lineHeightPercent": 140, "letterSpacingEm": 0
    },
    "logo-sample": {
      "family": "Inter", "weight": 800,
      "fontSizePx": 17, "lineHeight": "auto", "letterSpacingEm": 0
    }
  }
}
```

保留來源字體配置；若來源文字使用 Inter 但包含中文，需提供中文字體 fallback，避免缺字。中文統一使用 Noto Sans TC 及說明改用字重 400 均為未核定建議，不藉本文件全面替換既有字體。

## 6 按鈕資料

以下色彩字串是第 4 節的 token key；`transparent` 為透明背景。

```json
{
  "primaryButton": {
    "referenceSizePx": [116, 37], "visibleRadiusPx": 8,
    "typography": "primary-button", "border": null,
    "states": {
      "default": {"background": "accent", "text": "text-primary"},
      "hover": {"background": "accent-hover", "text": "text-primary"},
      "active": {"background": "primary-pressed", "text": "text-primary"}
    }
  },
  "secondaryButton": {
    "referenceSizePx": [118, 37], "visibleRadiusPx": 8,
    "typography": "secondary-button", "borderWidthPx": 3,
    "states": {
      "default": {"background": "surface", "border": "accent", "text": "accent"},
      "hover": {"background": "secondary-hover-bg", "border": "accent", "text": "secondary-interaction-text"},
      "active": {"background": "secondary-pressed-bg", "border": "accent", "text": "secondary-interaction-text"}
    }
  },
  "navigationButton": {
    "referenceSizePx": [206, 44], "radiusPx": 8,
    "paddingPx": [12, 12, 12, 12], "gapPx": 8,
    "iconSizePx": [20, 20], "typography": "sidebar-item",
    "states": {
      "default": {"background": "transparent", "text": "text-primary"},
      "hover": {"background": "surface-subtle", "text": "text-primary"},
      "active": {"background": "surface-active", "text": "text-primary"},
      "display-unresolved": {"background": "surface", "text": "surface-subtle"}
    }
  },
  "toolbarButton": {
    "visibleBackgroundSizePx": [44, 40], "visibleRadiusPx": 8,
    "iconSizePx": [24, 24], "referenceWrapperWidthsPx": [42, 44],
    "states": {
      "default": {"background": "transparent", "icon": "text-primary"},
      "hover": {"background": "surface-active", "icon": "text-primary"},
      "active": {"background": "accent", "icon": "surface"},
      "display-unresolved": {"background": "transparent", "iconOpacity": 0}
    }
  },
  "iconButton": {
    "referenceSizePx": [36, 36], "radiusPx": 8,
    "connectorIconSizePx": [23, 19],
    "states": {
      "default": {"background": "transparent"},
      "hover": {"background": "surface-active"},
      "active": {"background": "accent-hover"},
      "focus": {"background": "icon-focus-bg"}
    }
  }
}
```

主要及次要按鈕的可見背景由內層矩形提供，勿因外層框架無 fills、圓角為 0 而輸出無底色或直角按鈕。圖示按鈕圖示沿用原資產。

原稿的 `cursor` 在本規格對應 Default；`display` 保持未決，不直接映射為 HTML disabled。`active` 不應在所有元件中一律解釋成 CSS `:active` 或持續選取狀態，需依實際元件用途確認。

## 7 輸入框資料

```json
{
  "input": {
    "referenceSizePx": [332, 43], "radiusPx": 8,
    "paddingPx": [0, 9, 0, 9], "gapPx": 7,
    "borderWidthPx": 1, "typography": "input",
    "variants": ["text", "password-with-visibility-icon"],
    "states": {
      "default": {"background": "surface", "border": "surface-subtle", "text": "text-placeholder"},
      "hover": {"background": "surface", "border": "input-border-hover", "text": "text-placeholder"},
      "focus": {"background": "surface", "border": "accent", "text": "text-primary"},
      "filled": {"background": "surface", "border": "surface-subtle", "text": "text-primary"},
      "readonly": {"background": "surface", "border": "text-primary", "text": "text-primary"},
      "disabled": {"background": "surface-active", "border": null, "text": "surface-subtle"}
    }
  }
}
```

原稿 `finish` 對應 Filled。Filled 是內容狀態，可與 Hover 或 Focus 共存，不應用 filled 樣式覆蓋正在顯示的 Focus。密碼內容預設採密碼欄位語意；原稿中用明文示範不表示正式產品應預設暴露密碼。密碼切換開關外觀尚未完整定義。

## 8 導覽與面板資料

```json
{
  "sidebar": {
    "expandedWidthPx": 200, "collapsedWidthPx": 76,
    "referenceHeightPx": 720, "background": "surface",
    "paddingPx": [25, 14, 18, 14], "gapPx": 12
  },
  "topbar": {
    "referenceWidthPx": 1042, "heightPx": 60,
    "paddingPx": [0, 31, 0, 31], "background": "surface",
    "variants": ["page-title-and-version", "board-title-collaborators-and-invite"]
  },
  "rightPanel": {
    "widthPx": 320, "contentWidthPx": 280,
    "paddingPx": [23, 0, 23, 0], "gapPx": 18,
    "background": "surface",
    "referenceToolPanelHeightPx": 661,
    "referenceStylePanelHeightPx": 1204,
    "divider": {"heightPx": 1, "color": "surface-active"}
  },
  "panelSearch": {
    "referenceSizePx": [280, 36], "radiusPx": 4,
    "paddingPx": [0, 12, 0, 12], "gapPx": 8,
    "borderWidthPx": 1, "borderColor": "search-border",
    "background": "surface", "fontSizePx": 12,
    "placeholderColor": "surface-active"
  }
}
```

左右內距為 0 是右側面板外框的實測值；280px 內容應置於 320px 面板中，不代表文字貼齊面板邊緣。內側主要內容寬度差對應左右各 20px。

展開側欄 200px 與獨立導覽按鈕 206px 的寬度存在差異。不要直接嵌入造成溢位；依專案現有容器配置處理，若需變更核定尺寸則提出具體差異。頂部寬度及面板高度是稿面參考值，響應式斷點與收合條件未核定。

## 9 節點卡片資料

```json
{
  "nodeCard": {
    "referenceSizePx": [278, 149], "radiusPx": 8,
    "paddingPx": [14, 16, 14, 16], "gapPx": 16,
    "background": "surface", "borderWidthPx": 1,
    "shadow": null,
    "structure": ["category-and-add-action", "title", "description"],
    "categoryTypography": "node-category",
    "titleTypography": "node-card-title",
    "descriptionTypography": "node-card-description",
    "categoryExamples": ["TRIGGER", "ACTION", "FILTER"],
    "variants": {
      "default": {"borderColor": "surface-subtle", "sourceVariant": "cursor"},
      "emphasized-unresolved": {"borderColor": "accent", "sourceVariant": "n8n-card3"}
    }
  }
}
```

強制覆寫範例，以專案實際 selector 或元件樣式實現，不必使用下列 class 名稱：

```css
.node-card__description {
  font-size: 12px;
  line-height: 19.5px;
  letter-spacing: 0;
}
```

不得順便改為固定兩行截斷、增加高度或變更字重。若 12px 帶來實際排版問題，先檢查既有尺寸、字體載入及內容規則，再回報具體差異。工具面板內的卡片同樣採用此說明文字規格。

## 10 便條紙資料

```json
{
  "stickyNote": {
    "referenceSizePx": [160, 160], "radiusPx": 6,
    "paddingPx": [15, 15, 20, 15],
    "background": "note-bg", "textColor": "note-text",
    "typography": "sticky-note",
    "states": {
      "default": {"shadow": null, "foldedCornerVisible": false},
      "hover": {"shadowCss": "0 3px 8px 0 rgba(81, 71, 34, 0.149)", "foldedCornerVisible": true},
      "hold": {"shadowCss": "0 8px 16px 0 rgba(81, 71, 34, 0.302)", "foldedCornerVisible": true}
    }
  }
}
```

折角位於右下方，優先沿用來源資產。Hold 的完整拖曳流程及釋放行為屬未核定互動，不因存在此樣式就宣稱拖曳功能已完成。

## 11 圖示與資產

| 項目 | 實作依據 |
|---|---|
| 一般圖示 | 24 × 24 參考框；圓弧線條風格 |
| 導覽圖示 | 20 × 20 |
| 工具列圖示 | 24 × 24 |
| 連線選項 | 23 × 19；線型 3 種；起點與終點箭頭各 6 種 |
| 圖形選項 | 20 × 20；共 20 種 |

沿用原始 SVG 或現有專案資產；不以 emoji 或不同圖示庫風格替代。來源有手形 15 × 18、連結圖示約 24.07px 等例外，保持比例，不強制變形。不得從單一圖示推定所有圖示共用同一線寬。

正式互動控制需有可辨識名稱，且可由鍵盤操作。不可為了貼近尚未定義的狀態而移除專案既有的焦點提示、標籤或表單語意。

## 12 未決項目與未核定建議

| 項目 | 已知內容 | 不可自行認定的部分 |
|---|---|---|
| display | 部分按鈕有此變體 | 是否為 Disabled、隱藏或其他展示狀態 |
| n8n-card3 | 黃色邊框 | Hover、Selected 或 Focus |
| active | 各元件有對應外觀 | 暫時按下或持續選取 |
| 工具列尺寸 | 外框 42／44px；可見背景 44px | 全部統一後的核定尺寸 |
| 導覽尺寸 | 按鈕 206px；側欄 200px | 全站最終容器配置 |
| 表單 | 已有六種輸入外觀 | Label、Error、必填、密碼切換完整外觀 |
| 按鈕 | 主要與次要各三種外觀 | Focus、Disabled、Loading |
| 響應式 | 只有所選桌面元件參考 | 手機／平板斷點、面板遮罩與開合方式 |
| 長文字 | 有示範內容 | 截斷、增高、捲動與字數上限 |
| 動態效果 | 便條紙有 Hover／Hold 外觀 | 時長、緩動及拖曳流程 |

尚未核定的建議：卡片說明提高至字重 400、中文統一字體、黃色 tokens 合併，以及白底黃字／黃底白圖示／細字重／Disabled 文字的可讀性調整。不得默默套用；實作發現問題時附具體畫面或測量結果。

## 13 實作流程與驗收

1. 確認使用者本次授權的範圍及專案規則，查找現有樣式與元件。
2. 將本文件數值對應到現有 tokens；無對應者才依專案慣例新增。
3. 套用共用元件樣式；確保節點卡片說明的 12px 覆寫涵蓋工具面板及其他實例。
4. 依可用資產還原圖示與折角；保留可見背景層、邊框寬度與各狀態差異。
5. 做與修改範圍相稱的驗證；純樣式調整優先採畫面與 computed styles，不新增只重複常數的測試。
6. 回報修改內容、實際驗證及仍未解決的問題；僅修改本機不等於已發布或已更新 Figma。

驗收清單：

- [ ] 節點卡片說明 computed font-size 為 **12px**，line-height 為 **19.5px**，letter-spacing 為 0。
- [ ] 說明字級變更沒有連帶修改字重、卡片高度或長文字規則。
- [ ] 按鈕使用正確可見圓角；次要按鈕邊框為 3px。
- [ ] 輸入框六種狀態的顏色及邊框符合資料；Read-only 與 Disabled 語意有別。
- [ ] 節點卡片預設及黃色邊框變體符合資料，未擅自決定黃色變體的業務語意。
- [ ] 便條紙背景、文字、圓角、折角及兩種陰影符合資料。
- [ ] 沒有輸出 Figma 紫色元件集外框，也沒有把展示區底色直接設為網站背景。
- [ ] 導覽與面板未因直接套入獨立元件尺寸而產生非預期溢位。
- [ ] 沿用專案可存取性語意與焦點提示，未以未定義視覺狀態移除既有操作能力。
- [ ] 最終交付清楚區分已完成項目、實際驗證與未決項目。
