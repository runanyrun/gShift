"use client";

import { FormEvent, useState } from "react";

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
  onSubmit(values: EmployeeFormValues): Promise<void>;
}

export function EmployeeForm({
  initialValues,
  submitLabel,
  error,
  onSubmit,
}: EmployeeFormProps) {
  const [values, setValues] = useState<EmployeeFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);

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
    <form onSubmit={handleSubmit}>
      {error ? <p>{error}</p> : null}

      <h3>General</h3>
      <label>
        First Name
        <input
          required
          value={values.firstName}
          onChange={(event) => setValues({ ...values, firstName: event.target.value })}
        />
      </label>
      <label>
        Last Name
        <input
          required
          value={values.lastName}
          onChange={(event) => setValues({ ...values, lastName: event.target.value })}
        />
      </label>
      <label>
        Email
        <input
          type="email"
          required
          value={values.email}
          onChange={(event) => setValues({ ...values, email: event.target.value })}
        />
      </label>

      <h3>Job Info</h3>
      <label>
        Active
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(event) => setValues({ ...values, isActive: event.target.checked })}
        />
      </label>

      <h3>Pay &amp; Payroll</h3>
      <label>
        Payroll ID
        <input
          value={values.payrollId}
          onChange={(event) => setValues({ ...values, payrollId: event.target.value })}
        />
      </label>

      <h3>Notes</h3>
      <textarea
        value={values.notes}
        onChange={(event) => setValues({ ...values, notes: event.target.value })}
        rows={5}
      />

      <button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
