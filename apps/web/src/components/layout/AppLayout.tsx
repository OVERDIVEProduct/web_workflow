import { NavLink, Outlet, useLocation } from 'react-router';
import { useState } from 'react';
import { ROUTES } from '../../app/routes';

const iconRoot = '/images/navigation';
const nav = [
  { to: ROUTES.dashboard, label: '首頁', icon: 'home' },
  { to: ROUTES.workflows, label: '工作區', icon: 'grid' },
  { to: ROUTES.settings, label: '設定', icon: 'settings' },
  { to: ROUTES.profile, label: '個人檔案', icon: 'user' },
];

export default function AppLayout() {
  const { pathname } = useLocation();
  const isEditor = /^\/workflows\/[^/]+\/?$/.test(pathname);
  const [workflowHeader, setWorkflowHeader] = useState<HTMLDivElement | null>(null);
  const title = nav.find(({ to }) => pathname === to || pathname.startsWith(`${to}/`))?.label ?? '找不到頁面';

  return (
    <div className={`app-shell${isEditor ? ' app-shell-editor' : ''}`}>
      <aside className="sidebar">
        <NavLink to={ROUTES.dashboard} className="brand" aria-label="LooGoo 首頁">
          <span className="brand-mark"><img src={`${iconRoot}/zap.svg`} width={18} height={18} alt="" /></span>
          <span>LooGoo</span>
        </NavLink>
        <nav className="nav-list" aria-label="主要導覽">
          {nav.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} aria-label={label} title={label} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <img src={`${iconRoot}/${icon}.svg`} width={20} height={20} alt="" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span className="topbar-title">{isEditor ? '團隊協作白板' : title}</span>
          {isEditor ? <div ref={setWorkflowHeader} className="workflow-header-actions" /> : <span className="topbar-tag">開發版本</span>}
        </header>
        <main className="page-content"><Outlet context={{ workflowHeader }} /></main>
      </div>
    </div>
  );
}
