/** A function mapping an ISO instant to its calendar day, `YYYY-MM-DD`, in `timeZone`. */
export function dayKeyFormatter(timeZone?: string): (iso: string) => string {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (iso) => {
    const time = Date.parse(iso);
    return Number.isNaN(time) ? "unknown" : format.format(time);
  };
}

const dayHeading = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dayHeadingWithYear = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** `Today`, `Yesterday`, `Mon, Sep 28`, or with the year when it is not the current one. */
export function dayLabel(day: string, today: string, yesterday: string): string {
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Unknown day";
  return day.slice(0, 4) === today.slice(0, 4)
    ? dayHeading.format(date)
    : dayHeadingWithYear.format(date);
}
