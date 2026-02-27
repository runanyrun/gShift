"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Section } from "../../components/ui/section";

export interface EmployeeFormValues {
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  payrollId: string;
  notes: string;
}

interface EmployeeFormProps {
  initialValues: EmployeeFormValues;
  submitLabel: string;
  error: string | null;
  showNotes?: boolean;
  readOnly?: boolean;
  onSubmit(values: EmployeeFormValues): Promise<void>;
}

export function EmployeeForm({
  initialValues,
  submitLabel,
  error,
  showNotes = true,
  readOnly = false,
  onSubmit,
}: EmployeeFormProps) {
  const [values, setValues] = useState<EmployeeFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Section title="General" description="Core identity fields used across schedules and reports.">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-1">
              <Label htmlFor="employee-first-name">First name</Label>
              <Input
                id="employee-first-name"
                required
                disabled={readOnly}
                value={values.firstName}
                onChange={(event) => setValues({ ...values, firstName: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="employee-last-name">Last name</Label>
              <Input
                id="employee-last-name"
                required
                disabled={readOnly}
                value={values.lastName}
                onChange={(event) => setValues({ ...values, lastName: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="employee-email">Email</Label>
              <Input
                id="employee-email"
                type="email"
                required
                disabled={readOnly}
                value={values.email}
                onChange={(event) => setValues({ ...values, email: event.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Employment" description="Availability and payroll metadata for this employee profile.">
        <Card>
          <CardContent className="space-y-4 p-4">
            <label className="flex items-center gap-2 text-sm text-slate-700" htmlFor="employee-active">
              <input
                id="employee-active"
                type="checkbox"
                disabled={readOnly}
                checked={values.isActive}
                onChange={(event) => setValues({ ...values, isActive: event.target.checked })}
              />
              Active employee
            </label>
            <div className="space-y-1">
              <Label htmlFor="employee-payroll-id">Payroll ID</Label>
              <Input
                id="employee-payroll-id"
                disabled={readOnly}
                value={values.payrollId}
                onChange={(event) => setValues({ ...values, payrollId: event.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      </Section>

      {showNotes ? (
        <Section title="Notes" description="Operational context visible to managers.">
          <Card>
            <CardContent className="p-4">
              <textarea
                disabled={readOnly}
                value={values.notes}
                onChange={(event) => setValues({ ...values, notes: event.target.value })}
                rows={5}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </CardContent>
          </Card>
        </Section>
      ) : null}

      <div className="flex items-center gap-3">
        {readOnly ? (
          <p className="text-sm text-slate-600">You do not have permission to edit this employee.</p>
        ) : (
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : submitLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
