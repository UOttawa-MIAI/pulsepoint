import axios from 'axios';
import * as cheerio from 'cheerio';
import { UOttawaEvent, ScrapingResult } from './types.js';

const UOTTAWA_BASE_URL = 'https://www.uottawa.ca';
const EVENTS_ALL_URL = `${UOTTAWA_BASE_URL}/faculty-engineering/events-all`;

/**
 * Scrapes the first page of uOttawa Faculty of Engineering Events.
 * Since uOttawa lists events chronologically from current to future,
 * the first page contains all immediate upcoming events.
 */
export async function scrapeUOttawaEngineeringEvents(targetUrl = EVENTS_ALL_URL): Promise<ScrapingResult> {
  const timestamp = new Date().toISOString();

  const response = await axios.get<string>(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; UOttawa-MIAI-PulsePoint/1.0; +https://github.com/UOttawa-MIAI/pulsepoint)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(response.data);
  const events: UOttawaEvent[] = [];

  $('article.article-teaser').each((_, element) => {
    const el = $(element);

    // 1. Extract Canonical URL & Title
    const aboutAttr = el.attr('about');
    const linkEl = el.find('h2 a').first();
    const rawHref = linkEl.attr('href') || aboutAttr || '';
    
    if (!rawHref) {
      return; // Skip invalid article
    }

    const eventUrl = rawHref.startsWith('http') 
      ? rawHref 
      : `${UOTTAWA_BASE_URL}${rawHref.startsWith('/') ? '' : '/'}${rawHref}`;

    // Extract clean ID/Slug from URL
    const urlParts = eventUrl.split('/').filter(Boolean);
    const id = urlParts[urlParts.length - 1] || `event-${events.length}`;

    // Extract title text (clean up nested spans/whitespace)
    const title = linkEl.find('.link__content').text().trim() || linkEl.text().trim();

    // 2. Extract Description Summary
    const description = el.find('.article-teaser__item-text').first().text().replace(/\s+/g, ' ').trim();

    // 3. Extract Metadata Blocks in sequential order (Date -> Language -> Location)
    const metaBlocks: string[] = [];
    el.find('.article-teaser__item-body-wordwrap').each((_, metaEl) => {
      const text = $(metaEl).text().replace(/\s+/g, ' ').trim();
      if (text) {
        metaBlocks.push(text);
      }
    });

    const dateRaw = metaBlocks[0] || 'Date TBA';
    const language = metaBlocks[1] || 'English';
    const location = metaBlocks[2] || 'See event page for location';

    // 4. Extract High-Res Image (if available)
    let imageUrl: string | undefined = undefined;
    const sourceEl = el.find('picture source').first();
    const dataSrcset = sourceEl.attr('data-srcset') || sourceEl.attr('srcset');
    const imgEl = el.find('img').first();
    const dataSrc = imgEl.attr('data-src') || imgEl.attr('src');

    const rawImg = dataSrcset ? dataSrcset.split(' ')[0] : dataSrc;
    if (rawImg && !rawImg.startsWith('data:image')) {
      imageUrl = rawImg.startsWith('http') ? rawImg : `${UOTTAWA_BASE_URL}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`;
    }

    events.push({
      id,
      title,
      url: eventUrl,
      dateRaw,
      language,
      location,
      description,
      imageUrl,
      scrapedAt: timestamp,
    });
  });

  return {
    sourceUrl: targetUrl,
    scrapedAt: timestamp,
    totalEventsFound: events.length,
    events,
  };
}

// Standalone execution test for Step 1
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Running PulsePoint Scraper (Step 1 Test)...\n');
  scrapeUOttawaEngineeringEvents()
    .then((result) => {
      console.log(`✅ Successfully scraped ${result.totalEventsFound} events from ${result.sourceUrl}`);
      console.log(`⏱️ Scraped At: ${result.scrapedAt}\n`);
      console.log('📋 Sample Parsed Events:');
      result.events.forEach((evt, idx) => {
        console.log(`\n--- [Event ${idx + 1}] ---`);
        console.log(`📌 Title:       ${evt.title}`);
        console.log(`🆔 ID:          ${evt.id}`);
        console.log(`🕒 Date/Time:   ${evt.dateRaw}`);
        console.log(`📍 Location:    ${evt.location}`);
        console.log(`🌐 Language:    ${evt.language}`);
        console.log(`🔗 URL:         ${evt.url}`);
        if (evt.imageUrl) console.log(`🖼️ Image:       ${evt.imageUrl}`);
        console.log(`📝 Description: ${evt.description.slice(0, 120)}...`);
      });
    })
    .catch((err) => {
      console.error('❌ Scraping failed:', err);
      process.exit(1);
    });
}
