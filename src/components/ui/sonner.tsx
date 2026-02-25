"use client";

import * as React from "react";

type ToastItem = {
  id: number;
  title: string;
  description?: string;
};

let seed = 0;
const listeners = new Set<(toast: ToastItem) => void>();

export function toast(input: string | { title: string; description?: string }) {
  const payload = typeof input === "string" ? { title: input } : input;
  const next = { id: ++seed, title: payload.title, description: payload.description };
  listeners.forEach((listener) => listener(next));
}

export function Toaster() {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const onToast = (item: ToastItem) => {
      setItems((prev) => [...prev, item]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      }, 2500);
    };

    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto rounded-md border border-slate-200 bg-white px-3 py-2 shadow-md">
          <p className="text-sm font-medium text-slate-900">{item.title}</p>
          {item.description ? <p className="mt-0.5 text-xs text-slate-600">{item.description}</p> : null}
        </div>
      ))}
    </div>
  );
}
