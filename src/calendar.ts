/**
 * Reusable Calendar Invitation Utility
 * 
 * Supports:
 * - Google Calendar Web URLs
 * - Outlook.com / Office 365 Web URLs
 * - Apple / iOS / iCal standard RFC 5545 (.ics) content & Data URIs
 * - Smart parsing of human date/time strings (e.g. uOttawa formats)
 */

import type { CalendarEventDetails, CalendarLinks } from './types.js';

export type { CalendarEventDetails, CalendarLinks };

/**
 * Formats a Date object to ISO 8601 UTC string for calendar URLs: YYYYMMDDTHHmmssZ
 * Or YYYYMMDD for all-day events.
 */
function formatCalendarDate(date: Date, allDay = false): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());

  if (allDay) {
    return `${year}${month}${day}`;
  }

  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Generates a 1-click Google Calendar Event URL.
 */
export function generateGoogleCalendarUrl(event: CalendarEventDetails): string {
  const dates = event.allDay
    ? `${formatCalendarDate(event.startDate, true)}/${formatCalendarDate(event.endDate, true)}`
    : `${formatCalendarDate(event.startDate)}/${formatCalendarDate(event.endDate)}`;

  const detailsWithUrl = event.url ? `Event Link: ${event.url}` : (event.description?.slice(0, 150) || '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: dates,
    details: detailsWithUrl,
    location: event.location || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates an Outlook.com web calendar event URL.
 */
export function generateOutlookCalendarUrl(event: CalendarEventDetails): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: event.startDate.toISOString(),
    enddt: event.endDate.toISOString(),
    body: event.url ? `Event Link: ${event.url}` : (event.description?.slice(0, 150) || ''),
    location: event.location || '',
    allday: event.allDay ? 'true' : 'false',
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generates an Office 365 web calendar event URL (e.g. for uOttawa student/staff Microsoft accounts).
 */
export function generateOffice365CalendarUrl(event: CalendarEventDetails): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: event.startDate.toISOString(),
    enddt: event.endDate.toISOString(),
    body: event.url ? `Event Link: ${event.url}` : (event.description?.slice(0, 150) || ''),
    location: event.location || '',
    allday: event.allDay ? 'true' : 'false',
  });

  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generates standard RFC 5545 iCalendar (.ics) format string.
 * Supported by Apple Calendar (iOS / macOS), Outlook desktop, Google Calendar, Thunderbird.
 */
export function generateIcsContent(event: CalendarEventDetails): string {
  const now = new Date();
  const dtStamp = formatCalendarDate(now);
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}@uottawa-miai.pulsepoint`;

  const dtStart = event.allDay 
    ? `DTSTART;VALUE=DATE:${formatCalendarDate(event.startDate, true)}`
    : `DTSTART:${formatCalendarDate(event.startDate)}`;

  const dtEnd = event.allDay 
    ? `DTEND;VALUE=DATE:${formatCalendarDate(event.endDate, true)}`
    : `DTEND:${formatCalendarDate(event.endDate)}`;

  const cleanDescription = (event.description || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');

  const cleanTitle = event.title
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');

  const cleanLocation = (event.location || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//uOttawa MIAI//PulsePoint Event Engine//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    dtStart,
    dtEnd,
    `SUMMARY:${cleanTitle}`,
    cleanDescription ? `DESCRIPTION:${cleanDescription}` : '',
    cleanLocation ? `LOCATION:${cleanLocation}` : '',
    event.url ? `URL:${event.url}` : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

/**
 * Generates a Data URI for downloading or directly opening .ics on Apple devices / browsers.
 */
export function generateIcsDataUri(event: CalendarEventDetails): string {
  const ics = generateIcsContent(event);
  return `data:text/calendar;charset=utf8,${encodeURIComponent(ics)}`;
}

/**
 * Smart Date & Time parser for portal date strings.
 * 
 * Supports patterns:
 * - Date Range All Day: "Aug 24, 2026 to Aug 28, 2026 — All day"
 * - Single Date with Time Range: "Sep 3, 2026 — 8:30 a.m. to 3 p.m."
 * - Single Date with Single Time: "Sep 22, 2026 — 12 p.m. to 1 p.m."
 * - Timezone: Defaults to America/Toronto (Ottawa, Eastern Time)
 */
export function parsePortalDateString(dateRaw: string): { startDate: Date; endDate: Date; allDay: boolean } {
  const cleaned = dateRaw.replace(/\s+/g, ' ').trim();
  const currentYear = new Date().getFullYear();

  // Helper to parse time string like "8:30 a.m.", "3 p.m.", "12 p.m."
  const parseTime = (timeStr: string): { hours: number; minutes: number } => {
    const isPm = /p\.?m\.?/i.test(timeStr);
    const isAm = /a\.?m\.?/i.test(timeStr);
    const timeMatch = timeStr.replace(/[^\d:]/g, '').split(':');
    let hours = parseInt(timeMatch[0], 10) || 0;
    const minutes = timeMatch[1] ? parseInt(timeMatch[1], 10) : 0;

    if (isPm && hours < 12) hours += 12;
    if (isAm && hours === 12) hours = 0;

    return { hours, minutes };
  };

  // Helper to parse Ottawa Eastern Time to UTC Date
  const createOttawaDate = (year: number, monthName: string, day: number, hours = 9, minutes = 0): Date => {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const monthKey = monthName.slice(0, 3).toLowerCase();
    const month = months[monthKey] !== undefined ? months[monthKey] : 0;

    // Ottawa is Eastern Time (EDT = UTC-4 in summer, EST = UTC-5 in winter).
    // Use ISO string with Eastern offset to construct deterministic Date.
    // Approximate EDT (UTC-4) for typical academic term months March-November:
    const offset = (month >= 2 && month <= 10) ? '-04:00' : '-05:00';
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    const isoString = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00${offset}`;
    return new Date(isoString);
  };

  // Pattern 1: Date Range All Day (e.g. "Aug 24, 2026 to Aug 28, 2026 — All day" or "Aug 24 to Aug 28, 2026")
  const rangeMatch = cleaned.match(/([A-Za-z]+)\s+(\d+)(?:,?\s+(\d{4}))?\s+to\s+([A-Za-z]+)?\s*(\d+),?\s+(\d{4})(?:.*all\s*day)?/i);
  if (rangeMatch) {
    const startMonth = rangeMatch[1];
    const startDay = parseInt(rangeMatch[2], 10);
    const endYear = parseInt(rangeMatch[6], 10) || currentYear;
    const startYear = parseInt(rangeMatch[3], 10) || endYear;
    const endMonth = rangeMatch[4] || startMonth;
    const endDay = parseInt(rangeMatch[5], 10);

    const startDate = createOttawaDate(startYear, startMonth, startDay, 0, 0);
    // In iCal/Google Cal standard, all-day end date is exclusive (day after last day)
    const endDate = createOttawaDate(endYear, endMonth, endDay + 1, 0, 0);

    return { startDate, endDate, allDay: true };
  }

  // Pattern 2: Single Date with Time Range (e.g. "Sep 3, 2026 — 8:30 a.m. to 3 p.m.")
  const timeRangeMatch = cleaned.match(/([A-Za-z]+)\s+(\d+),?\s+(\d{4})\s*[-—–]\s*([0-9:apm.\s]+)\s+to\s+([0-9:apm.\s]+)/i);
  if (timeRangeMatch) {
    const month = timeRangeMatch[1];
    const day = parseInt(timeRangeMatch[2], 10);
    const year = parseInt(timeRangeMatch[3], 10) || currentYear;
    const startTimeStr = timeRangeMatch[4];
    const endTimeStr = timeRangeMatch[5];

    const startT = parseTime(startTimeStr);
    const endT = parseTime(endTimeStr);

    const startDate = createOttawaDate(year, month, day, startT.hours, startT.minutes);
    const endDate = createOttawaDate(year, month, day, endT.hours, endT.minutes);

    return { startDate, endDate, allDay: false };
  }

  // Pattern 3: Single Date with Single Time or All Day (e.g. "Sep 3, 2026 — 10 a.m." or "Sep 3, 2026 — All day")
  const singleDateMatch = cleaned.match(/([A-Za-z]+)\s+(\d+),?\s+(\d{4})(?:\s*[-—–]\s*(.*))?/i);
  if (singleDateMatch) {
    const month = singleDateMatch[1];
    const day = parseInt(singleDateMatch[2], 10);
    const year = parseInt(singleDateMatch[3], 10) || currentYear;
    const timePart = singleDateMatch[4] || '';

    const isAllDay = /all\s*day/i.test(timePart) || !timePart.trim();
    if (isAllDay) {
      const startDate = createOttawaDate(year, month, day, 0, 0);
      const endDate = createOttawaDate(year, month, day + 1, 0, 0);
      return { startDate, endDate, allDay: true };
    }

    const startT = parseTime(timePart);
    const startDate = createOttawaDate(year, month, day, startT.hours, startT.minutes);
    const endDate = createOttawaDate(year, month, day, startT.hours + 1, startT.minutes); // Default 1 hr duration

    return { startDate, endDate, allDay: false };
  }

  // Fallback: Default to next day 1-hour placeholder
  const fallbackStart = new Date();
  fallbackStart.setDate(fallbackStart.getDate() + 1);
  fallbackStart.setHours(12, 0, 0, 0);

  const fallbackEnd = new Date(fallbackStart.getTime() + 60 * 60 * 1000);
  return { startDate: fallbackStart, endDate: fallbackEnd, allDay: false };
}

/**
 * High-level helper to generate all calendar invitation links for any event.
 */
export function buildCalendarInvitations(event: {
  title: string;
  dateRaw: string;
  description?: string;
  location?: string;
  url?: string;
}): CalendarLinks & { parsedDates: { startDate: Date; endDate: Date; allDay: boolean } } {
  const parsedDates = parsePortalDateString(event.dateRaw);

  const details: CalendarEventDetails = {
    title: event.title,
    description: event.description,
    location: event.location,
    url: event.url,
    startDate: parsedDates.startDate,
    endDate: parsedDates.endDate,
    allDay: parsedDates.allDay,
  };

  return {
    google: generateGoogleCalendarUrl(details),
    outlook: generateOutlookCalendarUrl(details),
    office365: generateOffice365CalendarUrl(details),
    icsContent: generateIcsContent(details),
    icsDataUri: generateIcsDataUri(details),
    parsedDates,
  };
}

// Standalone test suite for calendar invitations
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🗓️ Testing Calendar Invitation Engine...\n');

  const testCases = [
    {
      title: 'Selected Areas in Cryptography Conference 2026',
      dateRaw: 'Aug 24, 2026 to Aug 28, 2026 — All day',
      location: 'In person, On campus',
      url: 'https://www.uottawa.ca/faculty-engineering/events-all/selected-areas-cryptography-conference-2026',
      description: 'The 33rd edition of Selected Areas in Cryptography Conference (SAC).',
    },
    {
      title: 'Engineering Preparatory Workshop',
      dateRaw: 'Sep 3, 2026 — 8:30 a.m. to 3 p.m.',
      location: 'In person, Learning Crossroads (CRX), Room 140',
      url: 'https://www.uottawa.ca/faculty-engineering/events-all/engineering-preparatory-workshop',
      description: 'Join us for a day of workshops and activities.',
    },
    {
      title: 'Engineering Graduate Welcome Information Session',
      dateRaw: 'Sep 16, 2026 — 9 a.m. to 10 a.m.',
      location: 'STEM Complex (STM), Room 117 (in person) / Zoom (virtual)',
      url: 'https://www.uottawa.ca/faculty-engineering/events-all/engineering-graduate-welcome',
      description: 'Orientation for new master and PhD students.',
    },
  ];

  testCases.forEach((tc, idx) => {
    const inv = buildCalendarInvitations(tc);
    console.log(`--- [Test ${idx + 1}: ${tc.title}] ---`);
    console.log(`🕒 Raw Date:       ${tc.dateRaw}`);
    console.log(`⏱️ Start (UTC):    ${inv.parsedDates.startDate.toISOString()}`);
    console.log(`⏱️ End (UTC):      ${inv.parsedDates.endDate.toISOString()}`);
    console.log(`📅 All-Day:        ${inv.parsedDates.allDay}`);
    console.log(`🔗 Google Cal URL: ${inv.google}`);
    console.log(`🔗 Office 365 URL: ${inv.office365}`);
    console.log(`📄 Sample ICS Line:\n${inv.icsContent.split('\r\n').slice(0, 10).join('\n')}...\n`);
  });
}
