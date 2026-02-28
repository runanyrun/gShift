"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Section } from "../../components/ui/section";
import { WorkDaysPicker } from "../../components/ui/work-days-picker";
import { type DayKey } from "../../lib/schedule-prefs";

export interface EmployeeOption {
  id: string;
  name: string;
}

export interface EmployeeFormValues {
  fullName: string;
  locationId: string;
  roleId: string;
  isActive: boolean;
  hourlyRate: string;
  email: string;
  portalAccessEnabled: boolean;
  phone: string;
  primaryRoleLabel: string;
  additionalRolesText: string;
  availabilityDays: DayKey[];
  payMode: "hourly" | "daily" | "salary";
  payAmount: string;
  startDate: string;
  defaultBreakMinutes: string;
  notes: string;
}

interface EmployeeFormProps {
  initialValues: EmployeeFormValues;
  locations: EmployeeOption[];
  roles: EmployeeOption[];
  submitLabel: string;
  error: string | null;
  readOnly?: boolean;
  onSubmit(values: EmployeeFormValues): Promise<void>;
}

export function EmployeeForm({
  initialValues,
  locations,
  roles,
  submitLabel,
  error,
  readOnly = false,
  onSubmit,
}: EmployeeFormProps) {
  const [values, setValues] = useState<EmployeeFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    if (!values.fullName.trim()) {
      setLocalError("Employee name is required.");
      return;
    }
    if (!values.locationId) {
      setLocalError("Select a location.");
      return;
    }
    if (!values.roleId) {
      setLocalError("Select a primary role.");
      return;
    }
    if (values.portalAccessEnabled && !values.email.trim()) {
      setLocalError("Email is required when portal access is enabled.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  }

  const visibleError = localError ?? error;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {visibleError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{visibleError}</p> : null}

      <Section title="Profile" description="Scheduling identity and contact preferences.">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-1">
              <Label htmlFor="employee-full-name">Full name</Label>
              <Input
                id="employee-full-name"
                required
                disabled={readOnly}
                value={values.fullName}
                onChange={(event) => setValues({ ...values, fullName: event.target.value })}
                placeholder="Alex Morgan"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="employee-phone">Phone (optional)</Label>
                <Input
                  id="employee-phone"
                  disabled={readOnly}
                  value={values.phone}
                  onChange={(event) => setValues({ ...values, phone: event.target.value })}
                  placeholder="+90 555 000 0000"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="employee-email">Email {values.portalAccessEnabled ? "" : "(optional)"}</Label>
                <Input
                  id="employee-email"
                  type="email"
                  disabled={readOnly}
                  value={values.email}
                  onChange={(event) => setValues({ ...values, email: event.target.value })}
                  placeholder="alex@company.com"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3 text-sm" htmlFor="employee-portal-access">
              <input
                id="employee-portal-access"
                type="checkbox"
                className="mt-1"
                disabled={readOnly}
                checked={values.portalAccessEnabled}
                onChange={(event) => setValues({ ...values, portalAccessEnabled: event.target.checked })}
              />
              <span className="space-y-1">
                <span className="block font-medium text-slate-900">Portal access</span>
                <span className="block text-slate-600">
                  {values.portalAccessEnabled
                    ? "Email will be used for invite and login access."
                    : "This employee can be scheduled but cannot log in yet."}
                </span>
              </span>
            </label>

            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
              Sensitive personal fields such as gender, birth date, and national ID stay out of this flow for now.
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Work" description="Primary assignment, availability, and future-safe role structure.">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="employee-location">Location</Label>
                <Select
                  id="employee-location"
                  disabled={readOnly}
                  value={values.locationId}
                  onChange={(event) => setValues({ ...values, locationId: event.target.value })}
                >
                  <option value="">Select location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="employee-role">Primary role</Label>
                <Select
                  id="employee-role"
                  disabled={readOnly}
                  value={values.roleId}
                  onChange={(event) => {
                    const nextRoleId = event.target.value;
                    const role = roles.find((item) => item.id === nextRoleId);
                    setValues({
                      ...values,
                      roleId: nextRoleId,
                      primaryRoleLabel: role?.name ?? values.primaryRoleLabel,
                    });
                  }}
                >
                  <option value="">Select role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="employee-primary-role-label">Primary role label</Label>
                <Input
                  id="employee-primary-role-label"
                  disabled={readOnly}
                  value={values.primaryRoleLabel}
                  onChange={(event) => setValues({ ...values, primaryRoleLabel: event.target.value })}
                  placeholder="Auto-filled from selected role"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="employee-additional-roles">Additional roles (optional)</Label>
                <Input
                  id="employee-additional-roles"
                  disabled={readOnly}
                  value={values.additionalRolesText}
                  onChange={(event) => setValues({ ...values, additionalRolesText: event.target.value })}
                  placeholder="Cashier, opener"
                />
              </div>
            </div>

            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
              TODO: additional roles are UI-only until the employee data model supports multi-role assignment.
            </div>

            <div className="space-y-1">
              <Label>Default availability</Label>
              <WorkDaysPicker
                value={values.availabilityDays}
                onChange={(availabilityDays) => setValues({ ...values, availabilityDays })}
                disabled={readOnly}
                helperText="Used as a planning hint in the UI. It does not yet block scheduling at the database level."
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700" htmlFor="employee-active">
              <input
                id="employee-active"
                type="checkbox"
                disabled={readOnly}
                checked={values.isActive}
                onChange={(event) => setValues({ ...values, isActive: event.target.checked })}
              />
              Active for scheduling
            </label>
          </CardContent>
        </Card>
      </Section>

      <Section title="Pay" description="Choose one default pay mode to keep the form light.">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "hourly", label: "Hourly rate" },
                { key: "daily", label: "Daily wage" },
                { key: "salary", label: "Salary" },
              ].map((option) => {
                const active = values.payMode === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setValues({ ...values, payMode: option.key as EmployeeFormValues["payMode"] })}
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="employee-pay-amount">
                  {values.payMode === "hourly" ? "Hourly rate" : values.payMode === "daily" ? "Daily wage" : "Salary"}
                </Label>
                <Input
                  id="employee-pay-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={readOnly}
                  value={values.payAmount}
                  onChange={(event) => {
                    const next = event.target.value;
                    setValues({
                      ...values,
                      payAmount: next,
                      hourlyRate: values.payMode === "hourly" ? next : values.hourlyRate,
                    });
                  }}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="employee-break">Default break (minutes)</Label>
                <Input
                  id="employee-break"
                  type="number"
                  min={0}
                  disabled={readOnly}
                  value={values.defaultBreakMinutes}
                  onChange={(event) => setValues({ ...values, defaultBreakMinutes: event.target.value })}
                  placeholder="30"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="employee-start-date">Start date (optional)</Label>
              <Input
                id="employee-start-date"
                type="date"
                disabled={readOnly}
                value={values.startDate}
                onChange={(event) => setValues({ ...values, startDate: event.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Notes" description="Short operational context for managers.">
        <Card>
          <CardContent className="p-4">
            <textarea
              disabled={readOnly}
              value={values.notes}
              onChange={(event) => setValues({ ...values, notes: event.target.value })}
              rows={4}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Optional scheduling notes"
            />
          </CardContent>
        </Card>
      </Section>

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
