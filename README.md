# 📡 PulsePoint

> **Automated Event & Course Synchronization Engine for the uOttawa MIAI Community**

PulsePoint is a lightweight, zero-cost automation service that continuously tracks the [University of Ottawa Faculty of Engineering Events](https://www.uottawa.ca/faculty-engineering/events-all) portal and synchronizes upcoming academic sessions, co-op deadlines, graduate orientations, and course survival intel directly into the MIAI Discord server.

---

## ✨ Features

- **⚡ Live Event Scraper**: Parses the official uOttawa Drupal events page with zero external API dependencies.
- **🛡️ Deduplication Engine**: Tracks posted vs. unposted events using a persistent JSON state file (`data/posted_events.json`).
- **🎨 Rich Discord Embeds**: Formats events into color-coded category cards with venue, calendar links, and RSVP buttons.
- **🔄 Zero-Cost GitHub Actions Runner**: Runs 24/7 on a scheduled cron (`0 */6 * * *`) with $0 hosting cost.

---

## 🛠️ Project Structure

```
pulsepoint/
├── .github/workflows/
│   └── pulsepoint-sync.yml     # Scheduled GitHub Actions cron runner
├── data/
│   └── posted_events.json      # Persistent state for deduplication
├── src/
│   ├── types.ts                # TypeScript interfaces for events & results
│   ├── scraper.ts              # uOttawa HTML parser & scraper
│   ├── classifier.ts           # Category tagger & Google Calendar link builder
│   ├── storage.ts              # State file manager
│   ├── discord.ts              # Discord Webhook embed generator
│   └── index.ts                # Main CLI runner (Instant Alert & Weekly Digest)
├── package.json
├── tsconfig.json
└── LICENSE
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm or pnpm

### Installation
```bash
git clone https://github.com/UOttawa-MIAI/pulsepoint.git
cd pulsepoint
npm install
```

### Run Scraper Test
```bash
npm run scrape
```

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
