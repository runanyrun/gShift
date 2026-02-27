import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export function AuthMarketingLayout({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-2 md:items-stretch">
        <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-950 p-8 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />
          <p className="text-sm font-semibold tracking-wide">qShift</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Workforce scheduling and marketplace, simplified.</h2>
          <ul className="mt-6 space-y-3 text-sm text-slate-200">
            <li>Plan shifts in minutes</li>
            <li>Multi-location ready</li>
            <li>Audit-safe job lifecycle</li>
          </ul>
          <p className="mt-10 max-w-md text-xs text-slate-300">
            Security and privacy first. Tenant boundaries and permission checks are enforced across the platform.
          </p>
        </section>

        <section className="flex items-center">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {children}
              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-600">
                <Link href="#" className="underline decoration-slate-300 underline-offset-4">
                  Forgot password
                </Link>
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
