// Calendar days as the API sends them ("YYYY-MM-DD"), worked out in UTC so no time zone shifts
// them. The choices offered mirror the API's rules (riders_place, riders_end_seat); the API still
// checks every date it's sent.

const parse = (day: string) => new Date(`${day}T00:00:00Z`);
const format = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(day: string, days: number) {
  const date = parse(day);
  date.setUTCDate(date.getUTCDate() + days);
  return format(date);
}

/** The 1st of the month `months` after `day`'s month. */
function firstOfMonth(day: string, months: number) {
  const date = parse(day);
  return format(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)),
  );
}

/**
 * The 1sts an adult may start on: today if it's the 1st, else the next 1st, up to the 1st of this
 * month next year.
 */
export function startMonths(today: string) {
  const first = today.endsWith("-01") ? 0 : 1;
  return Array.from({ length: 13 - first }, (_, index) =>
    firstOfMonth(today, first + index),
  );
}

/** The last days of a month an adult may leave on: this month's end up to a year from today. */
export function monthEnds(today: string) {
  const latest = addDays(today, 365);
  return Array.from({ length: 13 }, (_, index) =>
    addDays(firstOfMonth(today, index + 1), -1),
  ).filter((day) => day <= latest);
}

/** The latest day a company rider may start or leave on: a year from today. */
export const latestDay = (today: string) => addDays(today, 365);
