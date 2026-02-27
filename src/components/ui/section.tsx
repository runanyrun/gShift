import * as React from "react";

type SectionProps = {
  title: string;
  description?: string;
  rightActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function Section({ title, description, rightActions, children, className = "" }: SectionProps) {
  return (
    <section className={`space-y-3 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
        {rightActions ? <div className="flex flex-wrap items-center gap-2">{rightActions}</div> : null}
      </div>
      {children}
    </section>
  );
}
