export interface UOttawaEvent {
  /** Unique identifier derived from the event path/slug */
  id: string;
  /** Full title of the event */
  title: string;
  /** Canonical URL to the official event page on uOttawa */
  url: string;
  /** Raw date and time text as shown on the uOttawa portal */
  dateRaw: string;
  /** Event language (e.g. 'English', 'French', 'Bilingual') */
  language: string;
  /** Location or delivery format (e.g. 'In person, On campus', 'Virtual') */
  location: string;
  /** Cleaned short description/summary */
  description: string;
  /** Optional teaser / banner image URL */
  imageUrl?: string;
  /** Timestamp when the event was scraped */
  scrapedAt: string;
}

export interface ScrapingResult {
  sourceUrl: string;
  scrapedAt: string;
  totalEventsFound: number;
  events: UOttawaEvent[];
}

export interface CalendarEventDetails {
  title: string;
  description?: string;
  location?: string;
  url?: string;
  startDate: Date;
  endDate: Date;
  allDay?: boolean;
}

export interface CalendarLinks {
  google: string;
  outlook: string;
  office365: string;
  icsContent: string;
  icsDataUri: string;
}

export interface PostedEventRecord {
  id: string;
  title: string;
  postedAt: string;
  eventUrl: string;
}

export interface StorageData {
  lastSyncAt: string | null;
  totalPosted: number;
  postedEvents: Record<string, PostedEventRecord>;
}
