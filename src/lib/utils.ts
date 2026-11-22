export function generateICS(event: {
  title: string;
  description: string;
  location: string;
  start_date: string;
  end_date: string;
}) {
  const formatDate = (date: Date) =>
    date.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const start = formatDate(new Date(event.start_date));
  const end = formatDate(new Date(event.end_date));

  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Scientarium//Events Calendar//RU',
    'BEGIN:VEVENT',
    `UID:${start}-${encodeURIComponent(event.title)}@scientarium`,
    `DTSTAMP:${formatDate(new Date())}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape(event.description)}`,
    `LOCATION:${escape(event.location)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${event.title.slice(0, 30)}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
