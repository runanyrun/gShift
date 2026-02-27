import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

type AuthCardLayoutProps = {
  title: string;
  description: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export function AuthCardLayout({ title, description, footer, children }: AuthCardLayoutProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          {footer ? (
            <p className="border-t border-slate-200 pt-3 text-sm text-slate-600">
              {footer}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

export function AuthFooterLink({ href, label, text }: { href: string; label: string; text: string }) {
  return (
    <>
      {text}{" "}
      <Link href={href} className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4">
        {label}
      </Link>
    </>
  );
}
