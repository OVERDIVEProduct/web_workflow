import { useState } from 'react';
import type { WorkflowNodeKind } from '../types/workflow';

const assets = '/images/editor';
const tools: { type: WorkflowNodeKind; tag: string; name: string; summary: string }[] = [
  { type: 'manualTrigger', tag: 'TRIGGER', name: '手動觸發節點', summary: '點擊執行即可啟動工作流程，適合測試節點與驗證自動化步驟。' },
  { type: 'httpRequest', tag: 'ACTION', name: 'HTTP Request', summary: '向 API 發送 HTTP 請求，取得或傳送資料，串接外部服務。' },
  { type: 'if', tag: 'FILTER', name: '過濾篩選資料', summary: '設定篩選條件，只保留符合條件的資料，交給後續節點處理。' },
  { type: 'set', tag: 'ACTION', name: '設定資料', summary: '設定與整理工作流程中的資料欄位。' },
  { type: 'output', tag: 'OUTPUT', name: '查看輸出', summary: '查看工作流程的輸出資料。' },
];

export function EditorToolPanel({ ready, onAdd }: { ready: boolean; onAdd: (type: WorkflowNodeKind) => void }) {
  const [query, setQuery] = useState('');
  const matches = tools.filter(tool => `${tool.name} ${tool.summary} ${tool.tag}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <aside className="editor-tool-panel" id="editor-node-tools" aria-label="節點工具">
    <div className="editor-tool-heading"><h2>節點工具</h2><p>選擇工具，開始串起你的工作自動化</p></div>
    <div className="editor-tool-divider" />
    <label className="editor-tool-search">
      <img src={`${assets}/search.svg`} width={16} height={16} alt="" />
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜尋工具" aria-label="搜尋節點工具" />
    </label>
    <div className="editor-tool-list">
      {matches.map(tool => <button key={tool.type} type="button" className={`editor-tool-card${tool.type === 'manualTrigger' ? ' editor-tool-card-featured' : ''}`} disabled={!ready} onClick={() => onAdd(tool.type)} aria-label={`新增${tool.name}`}>
        <span className="editor-tool-card-top"><span className="editor-tool-tag">{tool.tag}</span><img src={`${assets}/add.svg`} width={18.5} height={18.5} alt="" /></span>
        <span className="editor-tool-card-name">{tool.name}</span>
        <span className="editor-tool-card-summary">{tool.summary}</span>
      </button>)}
      {!matches.length && <p className="editor-search-empty">找不到符合的工具</p>}
    </div>
  </aside>;
}

export function EditorToolbar({ mode, onMode, ready, onAdd, panelOpen, onTogglePanel }: {
  mode: 'select' | 'pan'; onMode: (mode: 'select' | 'pan') => void; ready: boolean;
  onAdd: (type: WorkflowNodeKind) => void; panelOpen: boolean; onTogglePanel: () => void;
}) {
  return <div className="editor-dock" role="toolbar" aria-label="白板工具">
    <button type="button" title="選取" aria-label="選取" aria-pressed={mode === 'select'} onClick={() => onMode('select')}><img src={`${assets}/select.svg`} width={24} height={24} alt="" /></button>
    <button type="button" title="移動畫布" aria-label="移動畫布" aria-pressed={mode === 'pan'} onClick={() => onMode('pan')}><img src={`${assets}/pan.svg`} width={24} height={24} alt="" /></button>
    <span className="editor-dock-divider" />
    <button type="button" title="新增便條紙" aria-label="新增便條紙" disabled={!ready} onClick={() => onAdd('stickyNote')}><img src={`${assets}/sticky.svg`} width={24} height={24} alt="" /></button>
    {(['text', 'shape', 'comment'] as const).map((icon, index) => <button key={icon} type="button" disabled title={`${['文字', '圖形', '留言'][index]}（尚未開放）`} aria-label={`${['文字', '圖形', '留言'][index]}（尚未開放）`}><img src={`${assets}/${icon}.svg`} width={24} height={24} alt="" /></button>)}
    <span className="editor-dock-divider" />
    <button type="button" className="editor-dock-wide" disabled title="範本（尚未開放）"><img src={`${assets}/template.svg`} width={24} height={24} alt="" /><span>範本</span></button>
    <button type="button" className="editor-dock-wide" aria-expanded={panelOpen} aria-controls="editor-node-tools" onClick={onTogglePanel}><img src={`${assets}/nodes.svg`} width={24} height={24} alt="" /><span>節點</span></button>
    <button type="button" className="editor-dock-wide" disabled title="匯入（尚未開放）"><img src={`${assets}/import.svg`} width={24} height={24} alt="" /><span>匯入</span></button>
  </div>;
}

export function EditorHeaderActions({ connected, ready, onlineCount, canUndo, canRedo, onUndo, onRedo, onSave, lastSaved }: {
  connected: boolean; ready: boolean; onlineCount: number; canUndo: boolean; canRedo: boolean;
  onUndo: () => void; onRedo: () => void; onSave: () => void; lastSaved: string;
}) {
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  async function invite() {
    const link = window.location.href;
    try { await navigator.clipboard.writeText(link); setInviteMessage('協作連結已複製'); }
    catch { setInviteLink(link); setInviteMessage('複製下方連結，邀請夥伴一起協作'); }
  }
  return <>
    <details className="editor-session-menu">
      <summary aria-label="協作狀態與備份" title={`目前 ${onlineCount} 人在線；查看協作狀態與備份`}>
        <span className="editor-avatars">{Array.from({ length: Math.min(onlineCount, 3) }, (_, index) => <span className={`editor-avatar editor-avatar-${index}`} key={index}><img src={`${assets}/participant.svg`} width={24} height={24} alt="" /></span>)}{onlineCount > 3 && <span className="editor-avatar editor-avatar-more">+{onlineCount - 3}</span>}</span>
      </summary>
      <div className="editor-session-popover">
        <p role="status">{!ready ? '等待首次同步' : connected ? `已連線 · ${onlineCount} 人在線` : '已斷線，等待重新連線'}</p>
        <button type="button" disabled={!ready || !canUndo} onClick={onUndo}>復原 <kbd>Ctrl+Z</kbd></button>
        <button type="button" disabled={!ready || !canRedo} onClick={onRedo}>重做 <kbd>Ctrl+Y</kbd></button>
        <button type="button" disabled={!ready} onClick={onSave}>備份至本機 <kbd>Ctrl+S</kbd></button>
        {lastSaved && <small>本機備份 {lastSaved}</small>}
      </div>
    </details>
    <button type="button" className="editor-invite" onClick={invite}>邀請協作</button>
    {inviteMessage && <div className="editor-invite-notice" role="status"><span>{inviteMessage}</span>{inviteLink && <input aria-label="協作連結" value={inviteLink} readOnly onFocus={event => event.target.select()} />}<button type="button" aria-label="關閉通知" onClick={() => { setInviteMessage(''); setInviteLink(''); }}>×</button></div>}
  </>;
}
