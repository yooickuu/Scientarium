/** SQLite UTC timestamps and PostgreSQL ISO timestamps must not get two offsets. */
export function parseDate(value: string | number | null | undefined): Date {
  if (value == null || value === '') return new Date(NaN);
  if (typeof value === 'number') return new Date(value);
  let input = value.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(input)) input = input.replace(' ', 'T') + 'Z';
  return new Date(input);
}
export function formatDate(value: string | number | null | undefined, locale: string, options: Intl.DateTimeFormatOptions = {day:'numeric',month:'long',year:'numeric'}): string {
  const date = parseDate(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, options).format(date) : '—';
}
