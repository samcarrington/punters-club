/** Shared across the server-rendered fallback and the client-side local-timezone script. */
export const SHOW_TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
};

export const formatShowTime = (
  startsAtUtc: string,
  timeZone: string,
  locale = "en-GB",
): string => {
  const date = new Date(startsAtUtc);
  const formatter = new Intl.DateTimeFormat(locale, {
    ...SHOW_TIME_FORMAT_OPTIONS,
    timeZone,
  });

  return formatter.format(date);
};
