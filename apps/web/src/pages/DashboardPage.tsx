import { Link } from "react-router";
import { ROUTES } from "../app/routes";
import PageTitle from "../components/ui/PageTitle";

export default function DashboardPage() {
  return (
    <div className="page-container">
      <PageTitle
        title="工作空間總覽"
        subtitle="從這裡進入你的自動化流程管理空間。"
      />
      <div className="stat-grid">
        <div className="panel">
          <small>工作流程</small>
          <strong>1</strong>
          <p>示範工作流程</p>
        </div>
        <div className="panel">
          <small>線上協作者</small>
          <strong>—</strong>
          <p>多人同步待接入</p>
        </div>
        <div className="panel">
          <small>執行次數</small>
          <strong>—</strong>
          <p>執行引擎待接入</p>
        </div>
      </div>
      <div className="panel">
        <h2>快速開始</h2>
        <p>前往工作流程列表，開啟示範編輯器。</p>
        <Link className="button-link" to={ROUTES.workflows}>
          查看工作流程
        </Link>
      </div>
    </div>
  );
}
