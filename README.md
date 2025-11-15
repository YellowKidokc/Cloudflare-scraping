# Cloudflare Scraping Agent

Autonomous Cloudflare-native web scraper with RSS integration and prophecy scoring system.

## Overview

A modular, autonomous web-scraping framework deployable on Cloudflare Workers, designed to:

- **Manual Mode**: Accept pasted URLs or list of sources for immediate scraping
- **Auto Mode**: Discover all internal links from a root domain (crawl depth 2-3)
- **RSS Mode**: Monitor configured RSS feeds, score new entries using a prophecy_score metric, and auto-scrape any feed with score > 5
- **Storage**: Save structured results as Markdown + JSON to Cloudflare R2 or Postgres
- **Adaptive Logic**: Automatically switch between scraping methods (fetch → Puppeteer → API fallback)

## Features

- **Autonomous Operation**: Runs on Cloudflare Workers with scheduled cron triggers
- **RSS Feed Monitoring**: Automated checking of RSS feeds with intelligent scoring
- **Adaptive Scraping**: Multiple fallback strategies for reliable content extraction
- **AI Summarization**: Optional integration with AI models for content summarization
- **Scalable Storage**: Support for both Cloudflare R2 and Postgres databases
- **Rate Limiting**: Built-in rate limiting using Cloudflare KV
- **Queue System**: Async job processing using Cloudflare Queues
- **Prophecy Scoring**: Specialized keyword-based scoring for theological content

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                        │
│                                                              │
│  ┌──────────────┐     ┌──────────────┐    ┌──────────────┐ │
│  │  HTTP API    │────▶│   Crawler    │───▶│   Storage    │ │
│  │  Endpoints   │     │   Module     │    │   Module     │ │
│  └──────────────┘     └──────────────┘    └──────────────┘ │
│         │                     │                    │         │
│         ▼                     ▼                    ▼         │
│  ┌──────────────┐     ┌──────────────┐    ┌──────────────┐ │
│  │  RSS Handler │────▶│ Summarizer   │───▶│  R2 Bucket   │ │
│  │              │     │              │    │  Postgres    │ │
│  └──────────────┘     └──────────────┘    └──────────────┘ │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐     ┌──────────────┐                     │
│  │ Cron Trigger │────▶│    Queue     │                     │
│  │ (Every 6hrs) │     │  Consumer    │                     │
│  └──────────────┘     └──────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Manual Crawl
```bash
POST /api/crawl
Content-Type: application/json

{
  "url": "https://example.com",
  "mode": "manual",  # or "auto" for recursive crawl
  "depth": 2
}
```

### RSS Feed Check
```bash
POST /api/rss
Content-Type: application/json

{
  "feed_url": "https://example.com/feed.xml",
  "threshold": 5.0
}
```

### Generate Summary
```bash
POST /api/summary
Content-Type: application/json

{
  "url": "https://example.com/article",
  "mode": "ai"  # or "auto" for extractive
}
```

### Admin Endpoints (Requires API Key)

```bash
# View scraping history
GET /api/admin/jobs?limit=100&offset=0
Authorization: Bearer YOUR_API_KEY

# View statistics
GET /api/admin/stats
Authorization: Bearer YOUR_API_KEY

# Export data as CSV
GET /api/admin/export
Authorization: Bearer YOUR_API_KEY

# Health check
GET /api/admin/health
Authorization: Bearer YOUR_API_KEY
```

## Configuration

Edit `config.json` to customize:

- RSS feed sources
- Prophecy scoring keywords and weights
- Scraper behavior (timeout, retries, user agents)
- Storage options (R2, Postgres)
- AI summarization settings

### Example Configuration

```json
{
  "rss_feeds": [
    {
      "url": "https://example.com/feed.xml",
      "name": "Prophecy News",
      "enabled": true,
      "check_interval_hours": 6
    }
  ],
  "scoring": {
    "prophecy_keywords": [
      "prophecy", "biblical", "revelation", "eschatology"
    ],
    "threshold": 5.0
  },
  "scraper": {
    "timeout_ms": 10000,
    "max_retries": 3,
    "max_crawl_depth": 3
  }
}
```

## Setup & Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed setup instructions.

### Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Wrangler**:
   Edit `wrangler.toml` with your Cloudflare account details

3. **Create required resources**:
   ```bash
   # Create R2 bucket
   wrangler r2 bucket create scraper-storage

   # Create D1 database
   wrangler d1 create scraper-metadata

   # Create KV namespace
   wrangler kv:namespace create CACHE

   # Create Queue
   wrangler queues create scraper-jobs
   ```

4. **Deploy**:
   ```bash
   npm run deploy
   ```

## Database Setup

### Postgres

Run the provided schema:

```bash
psql -U your_user -d your_database -f schema.sql
```

### Cloudflare D1

The D1 tables are created automatically on first use.

## Usage Examples

### Manual Scrape

```bash
curl -X POST https://your-worker.workers.dev/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "mode": "manual"
  }'
```

### Recursive Crawl

```bash
curl -X POST https://your-worker.workers.dev/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "mode": "auto",
    "depth": 2
  }'
```

### Check RSS Feed

```bash
curl -X POST https://your-worker.workers.dev/api/rss \
  -H "Content-Type: application/json" \
  -d '{
    "feed_url": "https://example.com/feed.xml",
    "threshold": 5.0
  }'
```

## Prophecy Scoring System

The system automatically scores content based on keyword matches:

- **High Priority Keywords** (2x weight): prophecy, biblical prophecy, end times, revelation
- **Medium Priority Keywords** (1x weight): biblical, eschatology, messiah, etc.
- **Title Matches**: +1.0 bonus per high-priority keyword in title

**Score >= 5.0** triggers automatic scraping when found in RSS feeds.

## Storage

### R2 Storage Structure

```
scraper-storage/
├── crawls/
│   ├── example-com/
│   │   ├── 2024-01-01-12-00-00.json
│   │   └── 2024-01-01-12-00-00.md
│   └── another-site-org/
│       └── ...
```

### Postgres Schema

See `schema.sql` for complete database schema including:
- `prophecy_feeds` - Main content storage
- `rss_feed_config` - Feed configurations
- `rss_items` - Individual RSS items
- `scrape_jobs` - Job queue
- `keyword_matches` - Keyword analysis

## Development

```bash
# Run locally
npm run dev

# Watch logs
npm run tail

# Run tests
npm test
```

## Environment Variables

Set in `wrangler.toml` or `.dev.vars`:

```
RSS_SCORE_THRESHOLD=5.0
MAX_CRAWL_DEPTH=3
RATE_LIMIT_REQUESTS=10
RATE_LIMIT_WINDOW=60
ADMIN_API_KEY=your-secret-key
OPENAI_API_KEY=sk-...  # Optional
POSTGRES_API_ENDPOINT=https://...  # Optional
```

## Troubleshooting

### Rate Limiting Issues
- Adjust `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_WINDOW` in wrangler.toml
- Check cache namespace is properly configured

### Scraping Failures
- Review user agent configuration in config.json
- Check if site blocks Cloudflare IPs
- Consider using Browser Rendering API for JS-heavy sites

### RSS Feed Errors
- Verify feed URL is accessible
- Check feed format (RSS 2.0 or Atom supported)
- Review error logs in admin stats endpoint

## Contributing

Contributions welcome! Please ensure:
- Code follows existing style
- Tests pass
- Documentation updated
- Commit messages are descriptive

## License

MIT License - See LICENSE file for details

## Links

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [R2 Storage](https://developers.cloudflare.com/r2/)
- [D1 Database](https://developers.cloudflare.com/d1/)
