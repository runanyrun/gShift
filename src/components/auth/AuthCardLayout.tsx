import Link from "next/link";

type AuthCardLayoutProps = {
  title: string;
  description: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export function AuthCardLayout({ title, description, footer, children }: AuthCardLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{description}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_0_rgb(0_0_0/0.06)]">
          <div className="space-y-4">{children}</div>
          {footer ? (
            <p className="mt-5 border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
              {footer}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export function AuthFooterLink({ href, label, text }: { href: string; label: string; text: string }) {
  return (
    <>
      {text}{" "}
      <Link
        href={href}
        className="font-semibold text-indigo-600 underline-offset-4 hover:underline"
      >
        {label}
      </Link>
    </>
  );
}
