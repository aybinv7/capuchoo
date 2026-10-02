const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;
const MAX_HOURLY_DAYS = 7;

export type Bucket = "hour" | "day";

export interface EventRange {
  from?: Date | undefined;
  to?: Date | undefined;
}

export interface ActivityQuery {
  from: Date;
  to: Date;
  bucket: Bucket;
  tz: string;
}

/** Why a range was refused, phrased for the caller. */
export class EventRangeError extends Error {}

function instant(raw: string | undefined, name: string): Date | undefined {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new EventRangeError(`${name} is not a date`);
  return parsed;
}

/** An optional [from, to) filter; both ends are ISO instants. */
export function parseEventRange(
  rawFrom: string | undefined,
  rawTo: string | undefined,
): EventRange {
  const from = instant(rawFrom, "from");
  const to = instant(rawTo, "to");
  if (from && to && from >= to) throw new EventRangeError("from must be before to");
  return { from, to };
}

/** True when the runtime knows the IANA zone; Postgres shares the same database. */
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** A bounded activity window: both ends required, at most a year, hourly only up to a week. */
export function parseActivityQuery(raw: {
  from?: string | undefined;
  to?: string | undefined;
  bucket?: string | undefined;
  tz?: string | undefined;
}): ActivityQuery {
  const { from, to } = parseEventRange(raw.from, raw.to);
  if (!from || !to) throw new EventRangeError("from and to are required");
  const days = (to.getTime() - from.getTime()) / DAY_MS;
  if (days > MAX_RANGE_DAYS)
    throw new EventRangeError(`a range spans at most ${MAX_RANGE_DAYS} days`);
  const bucket = raw.bucket ?? "day";
  if (bucket !== "day" && bucket !== "hour") throw new EventRangeError("bucket is day or hour");
  if (bucket === "hour" && days > MAX_HOURLY_DAYS)
    throw new EventRangeError(`hourly buckets span at most ${MAX_HOURLY_DAYS} days`);
  const tz = raw.tz || "UTC";
  if (tz.length > 64 || !isTimeZone(tz))
    throw new EventRangeError(`unknown time zone "${tz.slice(0, 64)}"`);
  return { from, to, bucket, tz };
}
