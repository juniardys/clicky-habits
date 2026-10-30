// Below this many active days a 30-day bar chart looks almost empty (a single
// bar on day 30), which new users read as an error. Charts show a short hint.
export const SPARSE_ACTIVE_DAYS = 3;

export function isSparse(days: { count: number }[]): boolean {
  return days.filter((d) => d.count > 0).length < SPARSE_ACTIVE_DAYS;
}
