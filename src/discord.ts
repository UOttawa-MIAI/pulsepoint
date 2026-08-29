import 'dotenv/config';
import axios from 'axios';
import { buildCalendarInvitations } from './calendar.js';
import type { DiscordEmbed, DiscordWebhookPayload, UOttawaEvent } from './types.js';

// uOttawa Brand Colors
export const UOTTAWA_GARNET_COLOR = 0x800020; // #800020

/**
 * Builds a rich Discord Embed card from a scraped uOttawa event.
 */
export function createEventDiscordEmbed(event: UOttawaEvent): DiscordEmbed {
  const invitations = buildCalendarInvitations({
    title: event.title,
    dateRaw: event.dateRaw,
    description: event.description,
    location: event.location,
    url: event.url,
  });

  const startUnix = Math.floor(invitations.parsedDates.startDate.getTime() / 1000);
  const discordTimestamp = `<t:${startUnix}:F> (<t:${startUnix}:R>)`;

  const fields = [
    {
      name: '🕒 Date & Time',
      value: `${event.dateRaw}\n${discordTimestamp}`,
      inline: false,
    },
    {
      name: '📍 Location',
      value: event.location || 'On campus / See event page',
      inline: true,
    },
    {
      name: '🌐 Language',
      value: event.language || 'English',
      inline: true,
    },
    {
      name: '🗓️ Add to Calendar',
      value: `[Google Calendar](${invitations.google}) • [Office 365](${invitations.office365})`,
      inline: false,
    },
  ];

  const embed: DiscordEmbed = {
    title: event.title.slice(0, 250),
    url: event.url,
    description: event.description ? `${event.description.slice(0, 1800)}\n\n[🔗 **Read Full Event Details on uOttawa**](${event.url})` : `[🔗 **Read Full Event Details on uOttawa**](${event.url})`,
    color: UOTTAWA_GARNET_COLOR,
    fields,
    footer: {
      text: 'uOttawa Faculty of Engineering • PulsePoint Sync',
    },
    timestamp: new Date().toISOString(),
  };

  if (event.imageUrl) {
    embed.image = {
      url: encodeURI(decodeURI(event.imageUrl)),
    };
  }

  return embed;
}

/**
 * Dispatches a single event to a Discord Webhook.
 */
export async function postEventToDiscord(
  event: UOttawaEvent,
  webhookUrl = process.env.DISCORD_WEBHOOK_URL
): Promise<boolean> {
  if (!webhookUrl) {
    throw new Error('DISCORD_WEBHOOK_URL is not defined in environment variables.');
  }

  const embed = createEventDiscordEmbed(event);

  const payload: DiscordWebhookPayload = {
    username: 'uOttawa PulsePoint',
    embeds: [embed],
  };

  try {
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    return response.status >= 200 && response.status < 300;
  } catch (error: any) {
    console.error(`❌ Failed to post event "${event.title}" to Discord:`, error.response?.data || error.message);
    return false;
  }
}

/**
 * Posts multiple events sequentially with a small rate-limiting delay between requests.
 */
export async function postBatchEventsToDiscord(
  events: UOttawaEvent[],
  webhookUrl = process.env.DISCORD_WEBHOOK_URL,
  delayMs = 1200
): Promise<{ successCount: number; failureCount: number; successfulEvents: UOttawaEvent[] }> {
  const successfulEvents: UOttawaEvent[] = [];
  let failureCount = 0;

  for (const event of events) {
    const success = await postEventToDiscord(event, webhookUrl);
    if (success) {
      successfulEvents.push(event);
      console.log(`  ✅ Posted to Discord: "${event.title}"`);
    } else {
      failureCount++;
    }

    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return { 
    successCount: successfulEvents.length, 
    failureCount, 
    successfulEvents 
  };
}

// Standalone test suite for Step 4
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🤖 Testing Discord Webhook Poster (Step 4)...\n');

  const sampleEvent: UOttawaEvent = {
    id: 'engineering-preparatory-workshop',
    title: 'Engineering Preparatory Workshop',
    url: 'https://www.uottawa.ca/faculty-engineering/events-all/engineering-preparatory-workshop',
    dateRaw: 'Sep 3, 2026 — 8:30 a.m. to 3 p.m.',
    language: 'English, French',
    location: 'In person, Learning Crossroads (CRX), Room 140',
    description: 'Join us for a day of workshops and activities to help with your transition to university. You’ll get to meet other engineering students and tour our state-of-the-art facilities.',
    imageUrl: 'https://www.uottawa.ca/faculty-engineering/sites/g/files/bhrskd396/files/styles/max_width_xl_5120px/public/2023-06/Engineering%20Preparatory%20Workshop%20.png?itok=Ohgq4tKM',
    scrapedAt: new Date().toISOString(),
  };

  const generatedEmbed = createEventDiscordEmbed(sampleEvent);
  console.log('📋 Sample Generated Discord Embed Preview:');
  console.log(JSON.stringify(generatedEmbed, null, 2));

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (webhookUrl && webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    console.log('\n🚀 DISCORD_WEBHOOK_URL detected! Sending live test message...');
    postEventToDiscord(sampleEvent, webhookUrl)
      .then(ok => {
        if (ok) {
          console.log('🎉 Live Discord Webhook message sent successfully! Check your Discord channel.');
        } else {
          console.error('❌ Live Discord Webhook message failed.');
        }
      })
      .catch(err => console.error('❌ Error during webhook call:', err));
  } else {
    console.log('\n💡 DISCORD_WEBHOOK_URL is not configured yet in .env.');
    console.log('To send a live test message, add your webhook URL to .env:');
    console.log('DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN\n');
  }
}
