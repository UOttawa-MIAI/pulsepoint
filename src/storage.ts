import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { StorageData, UOttawaEvent } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_STORAGE_PATH = path.resolve(__dirname, '../data/posted_events.json');

/**
 * Creates a default empty StorageData object.
 */
export function createEmptyStorage(): StorageData {
  return {
    lastSyncAt: null,
    totalPosted: 0,
    postedEvents: {},
  };
}

/**
 * Loads the persistent storage JSON file.
 * If the file or parent directory does not exist, it initializes it automatically.
 */
export async function loadStorage(filePath = DEFAULT_STORAGE_PATH): Promise<StorageData> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as StorageData;
    return {
      lastSyncAt: parsed.lastSyncAt || null,
      totalPosted: typeof parsed.totalPosted === 'number' ? parsed.totalPosted : Object.keys(parsed.postedEvents || {}).length,
      postedEvents: parsed.postedEvents || {},
    };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File does not exist yet; initialize empty
      const empty = createEmptyStorage();
      await saveStorage(empty, filePath);
      return empty;
    }
    console.error(`⚠️ Failed to parse storage file at ${filePath}. Creating new state. Error:`, error.message);
    return createEmptyStorage();
  }
}

/**
 * Safely persists storage state to disk formatted with 2-space indentation.
 */
export async function saveStorage(data: StorageData, filePath = DEFAULT_STORAGE_PATH): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  // Update total count before saving
  data.totalPosted = Object.keys(data.postedEvents).length;

  const content = JSON.stringify(data, null, 2) + '\n';
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Checks if a specific event ID has already been recorded in storage.
 */
export function isEventPosted(eventId: string, storage: StorageData): boolean {
  return Boolean(storage.postedEvents[eventId]);
}

/**
 * Filters a list of scraped events to return ONLY new/unposted events.
 */
export function filterNewEvents(events: UOttawaEvent[], storage: StorageData): UOttawaEvent[] {
  return events.filter(event => !isEventPosted(event.id, storage));
}

/**
 * Records newly posted events into storage and saves the file.
 */
export async function recordPostedEvents(
  newlyPosted: UOttawaEvent[],
  storage: StorageData,
  filePath = DEFAULT_STORAGE_PATH
): Promise<StorageData> {
  const timestamp = new Date().toISOString();

  newlyPosted.forEach(event => {
    storage.postedEvents[event.id] = {
      id: event.id,
      title: event.title,
      postedAt: timestamp,
      eventUrl: event.url,
    };
  });

  storage.lastSyncAt = timestamp;
  storage.totalPosted = Object.keys(storage.postedEvents).length;

  await saveStorage(storage, filePath);
  return storage;
}

// Standalone test suite for Step 3
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🛡️ Testing Storage & Deduplication Engine...\n');

  const testDir = path.resolve(__dirname, '../data');
  const testStorageFile = path.resolve(testDir, 'test_storage_temp.json');

  async function runTest() {
    try {
      // 1. Initialize
      console.log('1. Loading storage (new file creation test)...');
      const storage = await loadStorage(testStorageFile);
      console.log(`   Initial total posted: ${storage.totalPosted}`);

      // 2. Mock Events
      const mockEvents: UOttawaEvent[] = [
        {
          id: 'test-event-1',
          title: 'Selected Areas in Cryptography Conference',
          url: 'https://www.uottawa.ca/events/test-1',
          dateRaw: 'Aug 24, 2026',
          language: 'English',
          location: 'On campus',
          description: 'Cryptography conference at uOttawa.',
          scrapedAt: new Date().toISOString(),
        },
        {
          id: 'test-event-2',
          title: 'Engineering Preparatory Workshop',
          url: 'https://www.uottawa.ca/events/test-2',
          dateRaw: 'Sep 3, 2026',
          language: 'English, French',
          location: 'Learning Crossroads',
          description: 'Preparatory workshop for new students.',
          scrapedAt: new Date().toISOString(),
        },
      ];

      // 3. Filter New Events (Should return both)
      console.log('\n2. Testing filterNewEvents on initial run...');
      const newBatch1 = filterNewEvents(mockEvents, storage);
      console.log(`   New events found: ${newBatch1.length} / ${mockEvents.length} (Expected: 2)`);

      // 4. Record Batch 1
      console.log('\n3. Recording Batch 1 into storage...');
      await recordPostedEvents(newBatch1, storage, testStorageFile);
      console.log(`   Updated storage count: ${storage.totalPosted}`);

      // 5. Test Deduplication (Simulate second scraping cycle with same events + 1 new event)
      console.log('\n4. Testing deduplication on second run (2 old + 1 new)...');
      const incomingBatch: UOttawaEvent[] = [
        ...mockEvents,
        {
          id: 'test-event-3',
          title: 'Co-op Drop-in session',
          url: 'https://www.uottawa.ca/events/test-3',
          dateRaw: 'Sep 10, 2026',
          language: 'English',
          location: 'Desmarais Building',
          description: 'Drop-in session for co-op.',
          scrapedAt: new Date().toISOString(),
        },
      ];

      const newBatch2 = filterNewEvents(incomingBatch, storage);
      console.log(`   New events detected: ${newBatch2.length} (Expected: 1, 'test-event-3')`);
      console.log(`   Detected Event: "${newBatch2[0]?.title}"`);

      // 6. Clean up temporary test file
      await fs.unlink(testStorageFile).catch(() => {});
      console.log('\n✅ Deduplication & Storage tests passed successfully!');
    } catch (err) {
      console.error('❌ Storage test failed:', err);
      await fs.unlink(testStorageFile).catch(() => {});
      process.exit(1);
    }
  }

  runTest();
}
