function toRelativeUnit(deltaSeconds: number): { value: number; unit: Intl.RelativeTimeFormatUnit } {
  const absolute = Math.abs(deltaSeconds);
  if (absolute < 60) {
    return { value: Math.round(deltaSeconds), unit: "second" };
  }
  if (absolute < 3600) {
    return { value: Math.round(deltaSeconds / 60), unit: "minute" };
  }
  if (absolute < 86400) {
    return { value: Math.round(deltaSeconds / 3600), unit: "hour" };
  }
  if (absolute < 604800) {
    return { value: Math.round(deltaSeconds / 86400), unit: "day" };
  }
  return { value: Math.round(deltaSeconds / 604800), unit: "week" };
}

export function formatRelativeTime(inputIso: string, now = new Date()): string {
  const date = new Date(inputIso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  const deltaSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const { value, unit } = toRelativeUnit(deltaSeconds);
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(value, unit);
}
