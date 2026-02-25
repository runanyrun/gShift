import { PageHeader } from "../../../components/layout/PageHeader";
import { HoursCostReport } from "../../../components/reports/HoursCostReport";

export default function ReportsPage() {
  return (
    <section className="space-y-4">
      <PageHeader title="Reports" description="Weekly costs, budget status and employee-level breakdown." />
      <HoursCostReport />
    </section>
  );
}
