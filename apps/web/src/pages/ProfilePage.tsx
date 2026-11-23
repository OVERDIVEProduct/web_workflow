import { useState } from 'react';
import PageTitle from '../components/ui/PageTitle';

export default function ProfilePage() {
  const [name, setName] = useState(() => localStorage.getItem('overdrive:demo-name') ?? '示範使用者');
  const [saved, setSaved] = useState(false);
  return <div className="page-container">
    <PageTitle title="個人檔案" subtitle="顯示與編輯基本資料（登入與帳號 API 尚未接入）。" />
    <form className="panel form-panel" onSubmit={e => { e.preventDefault(); localStorage.setItem('overdrive:demo-name', name); setSaved(true); }}>
      <label htmlFor="display-name">顯示名稱</label><input id="display-name" value={name} onChange={e => { setName(e.target.value); setSaved(false); }} maxLength={40} />
      <button type="submit" className="primary-button">儲存示範資料</button>
      {saved && <p role="status">已儲存在目前瀏覽器。</p>}
      <p className="notice">目前不是正式帳號資料，請勿輸入敏感資訊。</p>
    </form>
  </div>;
}
