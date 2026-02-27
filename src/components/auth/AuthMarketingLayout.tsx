import Link from "next/link";

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
    <main className="flex min-h-screen bg-slate-50">
      {/* Left panel — branding */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-10 lg:flex lg:w-[480px] lg:shrink-0">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <span className="text-base font-bold tracking-tight text-white">gShift</span>
        </div>

        {/* Hero */}
        <div className="relative z-10">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white">
            Workforce scheduling<br />and marketplace,{" "}
            <span className="text-indigo-400">simplified.</span>
          </h2>

          <ul className="mt-8 space-y-4">
            {[
              { icon: "⚡", text: "Plan shifts in minutes, not hours" },
              { icon: "🌍", text: "Multi-location & multi-timezone ready" },
              { icon: "🔒", text: "Audit-safe job lifecycle & permissions" },
            ].map((item) => (
              <li key={item.text} className="flex items-start gap-3">
                <span className="mt-0.5 text-base">{item.icon}</span>
                <span className="text-sm text-slate-300">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Tagline */}
        <div className="relative z-10 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
          <p className="text-xs leading-relaxed text-slate-400">
            Security and privacy first. Tenant boundaries and permission checks are enforced across the
            platform.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900">gShift</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-7">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-500">{description}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_0_rgb(0_0_0/0.06)]">
            <div className="space-y-4">{children}</div>

            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
              <Link
                href="#"
                className="text-slate-500 transition-colors hover:text-indigo-600 hover:underline underline-offset-4"
              >
                Forgot password?
              </Link>
              <Link
                href="#"
                className="text-slate-500 transition-colors hover:text-indigo-600 hover:underline underline-offset-4"
              >
                Need help?
              </Link>
            </div>
          </div>

          {footer ? (
            <p className="mt-5 text-center text-sm text-slate-500">{footer}</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
