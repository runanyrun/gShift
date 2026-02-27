import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-xs text-slate-500">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
