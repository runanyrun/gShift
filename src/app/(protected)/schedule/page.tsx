import Link from "next/link";
import { Card, CardContent } from "../../../components/ui/card";
import { PageHeader } from "../../../components/layout/PageHeader";
import { WeeklySchedule } from "../../../components/schedule/WeeklySchedule";
import { KpiCard } from "../../../components/ui/kpi-card";
import { Section } from "../../../components/ui/section";

export default function SchedulePage() {
  return (
    <section className="space-y-6">
      <PageHeader
        title="Schedule"
        description="Plan weekly shifts in location timezone, then publish once the team is ready."
        actions={(
          <>
            <Link
              href="/onboarding"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
            >
              Setup flow
            </Link>
            <Link
              href="/settings/company"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
            >
              Company defaults
            </Link>
          </>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Planning mode" value="Weekly" hint="Build and review one location week at a time" />
        <KpiCard label="Timezone source" value="Location" hint="Shift times follow each location timezone" />
        <KpiCard label="Detail workflow" value="Sheet" hint="Edit details in side sheet to keep the grid clean" />
      </div>

      <Section title="Weekly Planner" description="Primary task: place and adjust shifts. Secondary details stay in dialogs and sheets.">
        <Card>
          <CardContent className="p-4 md:p-6">
            <WeeklySchedule />
          </CardContent>
        </Card>
      </Section>
    </section>
  );
}
