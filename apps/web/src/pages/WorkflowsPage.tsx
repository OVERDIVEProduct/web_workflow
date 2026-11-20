import { Link } from 'react-router';
import PageTitle from '../components/ui/PageTitle';
import { ROUTES } from '../app/routes';

export default function WorkflowsPage() {
  return <div className="page-container">
    <PageTitle title="工作流程" subtitle="管理、開啟與編輯所有自動化流程。" />
    <div className="panel workflow-list-item"><div><h2>示範工作流程</h2><p>Manual Trigger → HTTP Request → Output</p></div>
      <Link className="button-link" to={ROUTES.workflow('demo')}>開啟編輯器</Link>
    </div>
    <p className="notice">目前提供示範流程；工作流程 CRUD、資料庫及帳號功能仍待後端實作。</p>
  </div>;
}
