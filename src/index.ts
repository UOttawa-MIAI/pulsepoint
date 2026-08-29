import 'dotenv/config';
import { scrapeUOttawaEngineeringEvents } from './scraper.js';
import { loadStorage, filterNewEvents, recordPostedEvents } from './storage.js';
import { postBatchEventsToDiscord } from './discord.js';
import type { UOttawaEvent } from './types.js';

interface SyncOptions {
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Main PulsePoint Synchronization Runner.
 * 
 * Pipeline:
 * 1. Load persistent deduplication state
 * 2. Scrape upcoming uOttawa Engineering events
 * 3. Filter unposted events
 * 4. Post rich embeds to Discord
 * 5. Update and persist posted_events.json
 */
export async function runPulsePointSync(options: SyncOptions = {}): Promise<{
  totalScraped: number;
  newEventsFound: number;
  postedCount: number;
}> {
  console.log('📡 =========================================');
  console.log('📡 PulsePoint Event Synchronization Engine');
  console.log('📡 =========================================\n');

  const { dryRun = false, force = false } = options;
  if (dryRun) console.log('🔍 [DRY-RUN MODE]: No Discord messages or file changes will be made.\n');
  if (force) console.log('⚡ [FORCE MODE]: Ignoring deduplication cache, re-processing all events.\n');

  // 1. Load Storage
  console.log('📦 Step 1: Loading deduplication state...');
  const storage = await loadStorage();
  console.log(`   Previously posted events in history: ${storage.totalPosted}\n`);

  // 2. Scrape Events
  console.log('🌐 Step 2: Scraping latest uOttawa Engineering events...');
  const scrapeResult = await scrapeUOttawaEngineeringEvents();
  console.log(`   Scraped ${scrapeResult.totalEventsFound} total events from uOttawa.\n`);

  // 3. Filter New / Unposted Events
  console.log('🔍 Step 3: Checking for new events...');
  const newEvents: UOttawaEvent[] = force 
    ? scrapeResult.events 
    : filterNewEvents(scrapeResult.events, storage);

  if (newEvents.length === 0) {
    console.log('✨ All events are up to date. No new announcements to post.\n');
    return {
      totalScraped: scrapeResult.totalEventsFound,
      newEventsFound: 0,
      postedCount: 0,
    };
  }

  console.log(`🎯 Found ${newEvents.length} NEW event(s) to post:\n`);
  newEvents.forEach((evt, idx) => {
    console.log(`   [${idx + 1}] ${evt.title} (${evt.dateRaw})`);
  });
  console.log('');

  if (dryRun) {
    console.log('🛑 Dry-run completed. Skipping Discord dispatch and storage commit.');
    return {
      totalScraped: scrapeResult.totalEventsFound,
      newEventsFound: newEvents.length,
      postedCount: 0,
    };
  }

  // 4. Post to Discord
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('❌ Cannot post events: DISCORD_WEBHOOK_URL is not set in environment.');
  }

  console.log('🚀 Step 4: Dispatching rich embed cards to Discord...');
  const { successCount, failureCount } = await postBatchEventsToDiscord(newEvents, webhookUrl);
  console.log(`\n📊 Discord Dispatch Results: ${successCount} successful, ${failureCount} failed.\n`);

  // 5. Update Storage
  if (successCount > 0) {
    console.log('💾 Step 5: Committing new events to storage...');
    const successfullyPostedEvents = newEvents.slice(0, successCount);
    await recordPostedEvents(successfullyPostedEvents, storage);
    console.log(`   Storage updated. Total historical events: ${storage.totalPosted}\n`);
  }

  console.log('🎉 Synchronization completed successfully!');
  return {
    totalScraped: scrapeResult.totalEventsFound,
    newEventsFound: newEvents.length,
    postedCount: successCount,
  };
}

// CLI Execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.includes('-d');
  const isForce = args.includes('--force') || args.includes('-f');

  runPulsePointSync({ dryRun: isDryRun, force: isForce })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ PulsePoint sync failed:', err);
      process.exit(1);
    });
}
