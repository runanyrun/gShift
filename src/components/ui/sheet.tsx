import * as React from "react";

export function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close sheet"
        className="fixed inset-0 z-40 bg-slate-900/30"
        onClick={() => onOpenChange?.(false)}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l border-slate-200 bg-white shadow-xl">
        <div className="h-full overflow-y-auto p-4">{children}</div>
      </div>
    </>
  );
}

export function SheetHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 border-b border-slate-200 pb-3">{children}</div>;
}

export function SheetTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-slate-900">{children}</h2>;
}

export function SheetDescription({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-sm text-slate-600">{children}</p>;
}

export function SheetFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">{children}</div>;
}
