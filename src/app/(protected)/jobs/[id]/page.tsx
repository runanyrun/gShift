import { WorkerJobDetailPage } from "../../../../components/jobs/WorkerJobDetailPage";

export default async function ProtectedJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkerJobDetailPage jobId={id} />;
}
