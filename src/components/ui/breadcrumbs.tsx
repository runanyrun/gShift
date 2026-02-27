import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({
  items,
  backHref,
  backLabel = "Back",
}: {
  items: BreadcrumbItem[];
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-slate-600">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-slate-900">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "font-medium text-slate-900" : ""}>{item.label}</span>
              )}
              {!isLast ? <span className="text-slate-400">/</span> : null}
            </span>
          );
        })}
      </nav>
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          {backLabel}
        </Link>
      ) : null}
    </div>
  );
}
