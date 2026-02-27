"use client";

import { PageHeader } from "../../../components/layout/PageHeader";
import { HoursCostReport } from "../../../components/reports/HoursCostReport";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { EmptyState } from "../../../components/ui/empty-state";
import { KpiCard } from "../../../components/ui/kpi-card";
import { Section } from "../../../components/ui/section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";

export default function ReportsPage() {
  return (
    <section className="space-y-6">
      <PageHeader
        title="Reports"
        description="Track weekly costs, hours, and budget variance with tenant-scoped schedule data."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Labor costs" value="Live" hint="Updated from schedule data" />
        <KpiCard label="Coverage trends" value="Planned" hint="Coming in the next report pack" />
        <KpiCard label="Exports" value="Planned" hint="CSV and PDF exports will be available soon" />
      </div>

      <Section title="Report Library" description="Start with the main operational report, then expand into advanced analytics.">
        <Tabs defaultValue="hours-cost" className="space-y-4">
          <TabsList>
            <TabsTrigger value="hours-cost">Hours & Cost</TabsTrigger>
            <TabsTrigger value="coming-soon">Forecast & Attendance</TabsTrigger>
          </TabsList>

          <TabsContent value="hours-cost">
            <HoursCostReport />
          </TabsContent>

          <TabsContent value="coming-soon">
            <Card>
              <CardHeader>
                <CardTitle>More reports are coming</CardTitle>
                <CardDescription>Labor trend, overtime, attendance, and forecast views will ship next.</CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyState
                  title="This report module is not live yet"
                  description="Use Hours & Cost today. Forecast and attendance reports are scaffolded and will plug into new APIs in the next sprint."
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Section>
    </section>
  );
}
