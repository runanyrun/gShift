type LimitedModeAlertProps = {
  warning: string;
  title?: string;
  message?: string;
};

export function LimitedModeAlert({
  warning,
  title = "Settings are in limited mode",
  message = "Some settings are not persisted yet.",
}: LimitedModeAlertProps) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <p className="font-semibold">{title}</p>
      <p>{message}</p>
      <p className="text-xs text-amber-800">{warning}</p>
    </div>
  );
}
