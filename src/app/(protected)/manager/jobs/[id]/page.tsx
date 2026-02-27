import { ManagerJobDetailPage } from "../../../../../components/manager/ManagerJobDetailPage";

export default async function ProtectedManagerJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ManagerJobDetailPage jobId={id} />;
}
