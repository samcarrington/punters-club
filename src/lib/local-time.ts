export const formatShowTime = (
  startsAtUtc: string,
  timeZone: string,
  locale = "en-GB",
): string => {
  const date = new Date(startsAtUtc);
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  });

  return formatter.format(date);
};
