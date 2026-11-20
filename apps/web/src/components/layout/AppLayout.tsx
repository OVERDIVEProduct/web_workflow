import { NavLink, Outlet } from 'react-router';
import { LayoutDashboard, Workflow, Settings, UserCircle2, Zap } from 'lucide-react';
import { ROUTES } from '../../app/routes';

const nav = [
  { to: ROUTES.dashboard, label: '總覽', Icon: LayoutDashboard },
  { to: ROUTES.workflows, label: '工作流程', Icon: Workflow },
  { to: ROUTES.settings, label: '設定', Icon: Settings },
  { to: ROUTES.profile, label: '個人檔案', Icon: UserCircle2 },
];

export default function AppLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to={ROUTES.dashboard} className="brand">
          <span className="brand-mark"><Zap size={18} strokeWidth={2.5} /></span>
          <span>OVERDRIVE</span>
        </NavLink>
        <div className="sidebar-caption">WORKSPACE</div>
        <nav className="nav-list" aria-label="主要導覽">
          {nav.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">Starter v0.1 · 前端示範</div>
      </aside>
      <div className="main-area">
        <header className="topbar"><span>自動化工作流程平台</span><span className="topbar-tag">開發版本</span></header>
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}
