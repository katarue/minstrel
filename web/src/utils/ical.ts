function escapeIcal(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toIcalDate(iso: string): string {
  return iso.replace(/[-:]/g, "").split(".")[0] + "Z";
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3600 * 1000).toISOString();
}

export type IcalEvent = {
  id: string;
  event_name: string;
  start_datetime: string;
  end_datetime?: string | null;
  description?: string | null;
  venue_name?: string | null;
};

export function toVEvent(event: IcalEvent, baseUrl: string): string {
  const start = toIcalDate(event.start_datetime);
  const end = toIcalDate(event.end_datetime ?? addHours(event.start_datetime, 3));
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.id}@minstrel.live`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcal(event.event_name)}`,
    ...(event.description ? [`DESCRIPTION:${escapeIcal(event.description)}`] : []),
    ...(event.venue_name ? [`LOCATION:${escapeIcal(event.venue_name)}`] : []),
    `URL:${baseUrl}/events/${event.id}`,
    "END:VEVENT",
  ];
  return lines.join("\r\n");
}

export function buildIcal(vevents: string[], calName: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Minstrel//Game Music Concert Portal//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calName}`,
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function googleCalendarUrl(event: IcalEvent): string {
  const start = toIcalDate(event.start_datetime);
  const end = toIcalDate(event.end_datetime ?? addHours(event.start_datetime, 3));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.event_name,
    dates: `${start}/${end}`,
    ...(event.venue_name ? { location: event.venue_name } : {}),
    ...(event.description ? { details: event.description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
