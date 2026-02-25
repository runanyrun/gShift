import Link from "next/link";
import { Card, CardContent } from "../../components/ui/card";
import { PageHeader } from "../../components/layout/PageHeader";
import { PageShell } from "../../components/layout/PageShell";
import { WeeklySchedule } from "../../components/schedule/WeeklySchedule";

export default function SchedulePage() {
  return (
    <PageShell>
      <PageHeader
        title="Schedule"
        description="Plan shifts, drag & drop, copy last week."
        actions={(
          <>
            <Link
              href="/onboarding"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
            >
              Onboarding
            </Link>
            <Link
              href="/settings/company"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
            >
              Company settings
            </Link>
          </>
        )}
      />
      <Card>
        <CardContent className="p-4 md:p-6">
          <WeeklySchedule />
        </CardContent>
      </Card>
    </PageShell>
  );
}
