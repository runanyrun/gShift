import * as React from "react";
import { Button } from "./button";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">{description}</p>
      {actionLabel && onAction ? (
        <div className="mt-4">
          <Button type="button" variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
