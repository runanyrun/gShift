import * as React from "react";

type DropdownContextValue = {
  open: boolean;
  setOpen: (value: boolean) => void;
};

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

function useDropdownContext() {
  const ctx = React.useContext(DropdownContext);
  if (!ctx) {
    throw new Error("DropdownMenu components must be used within <DropdownMenu>");
  }
  return ctx;
}

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return <DropdownContext.Provider value={{ open, setOpen }}>{children}</DropdownContext.Provider>;
}

export function DropdownMenuTrigger({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen } = useDropdownContext();

  return (
    <button type="button" className={className} onClick={() => setOpen(!open)} {...props}>
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  children,
  align = "start",
  className = "",
}: {
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const { open, setOpen } = useDropdownContext();
  if (!open) {
    return null;
  }

  const alignClass = align === "end" ? "right-0" : "left-0";
  return (
    <>
      <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
      <div
        className={`absolute z-50 mt-2 min-w-[10rem] rounded-md border border-slate-200 bg-white p-1 text-slate-900 shadow-md ${alignClass} ${className}`.trim()}
      >
        {children}
      </div>
    </>
  );
}

export function DropdownMenuItem({
  className = "",
  onSelect,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { onSelect?: () => void }) {
  const { setOpen } = useDropdownContext();
  return (
    <button
      type="button"
      className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-slate-100 ${className}`.trim()}
      onClick={(event) => {
        props.onClick?.(event);
        onSelect?.();
        setOpen(false);
      }}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className = "" }: { className?: string }) {
  return <div className={`my-1 h-px bg-slate-200 ${className}`.trim()} />;
}
