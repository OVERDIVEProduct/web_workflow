import { Link, useParams } from 'react-router';
import { ROUTES } from '../app/routes';
import WorkflowEditor from '../features/workflow/components/WorkflowEditor';

export default function WorkflowPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <p>找不到工作流程 ID。</p>;
  return <section className="workflow-page">
    <div className="workflow-header"><div><Link to={ROUTES.workflows}>← 返回工作流程</Link><h1>流程編輯器 <span>/{id}</span></h1></div><span className="status-pill">多人協作實驗模式</span></div>
    <WorkflowEditor workflowId={id} />
  </section>;
}
