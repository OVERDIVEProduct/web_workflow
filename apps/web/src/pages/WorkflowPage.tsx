import { useParams } from 'react-router';
import WorkflowEditor from '../features/workflow/components/WorkflowEditor';

export default function WorkflowPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <p>找不到工作流程 ID。</p>;
  return <section className="workflow-page" aria-label={`團隊協作白板 ${id}`}>
    <WorkflowEditor key={id} workflowId={id} />
  </section>;
}
