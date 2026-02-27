import Link from "next/link";
import { BRAND } from "../../lib/brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export function AuthMarketingLayout({
  title,
  description,
  footer,
  forgotPasswordHref,
  forgotPasswordDisabled,
  children,
}: {
  title: string;
  description: string;
  footer?: React.ReactNode;
  forgotPasswordHref?: string;
  forgotPasswordDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-sky-50 px-4 py-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-5 md:grid-cols-2 md:gap-8">
        <section className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950 px-6 py-7 text-white sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.1)_1px,transparent_1px)] bg-[size:26px_26px]" />
          <div className="pointer-events-none absolute -left-16 -top-12 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="relative">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-sm font-semibold">
              qS
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{BRAND.name}</h1>
            <p className="mt-3 max-w-md text-sm text-slate-200">{BRAND.tagline}</p>

            <ul className="mt-8 space-y-3 text-sm text-slate-100">
              <li>Plan shifts in minutes</li>
              <li>Multi-location ready</li>
              <li>Audit-safe approvals and invites</li>
            </ul>

            <div className="mt-12 text-xs text-slate-300">
              <Link href="#" className="underline decoration-slate-400 underline-offset-4">
                Security & privacy-ready
              </Link>
            </div>
          </div>
        </section>

        <section className="flex items-stretch md:items-center">
          <Card className="w-full rounded-2xl border-slate-200/90 shadow-lg shadow-slate-200/60">
            <CardHeader>
              <CardTitle className="text-2xl tracking-tight">{title}</CardTitle>
              <CardDescription className="text-sm text-slate-600">{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {children}
              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-600">
                {forgotPasswordHref ? (
                  <Link href={forgotPasswordHref} className="underline decoration-slate-300 underline-offset-4">
                    Forgot password?
                  </Link>
                ) : forgotPasswordDisabled ? (
                  <span className="cursor-not-allowed text-slate-400" aria-disabled="true" title="TODO: forgot password route">
                    Forgot password?
                  </span>
                ) : (
                  <span />
                )}
                <Link href="#" className="underline decoration-slate-300 underline-offset-4">
                  Need help?
                </Link>
              </div>
              {footer ? <p className="text-sm text-slate-600">{footer}</p> : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
