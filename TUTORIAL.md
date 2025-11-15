# Quick Start Tutorial

This tutorial will walk you through setting up and using the Cloudflare Scraping Agent.

## 10-Minute Quick Start

### Prerequisites Check

```bash
# Check Node.js (need v18+)
node --version

# Install Wrangler if not already installed
npm install -g wrangler

# Verify Wrangler installation
wrangler --version
```

### Step 1: Project Setup (2 minutes)

```bash
# Clone or navigate to the project
cd Cloudflare-scraping

# Install dependencies
npm install
```

### Step 2: Configure Environment (3 minutes)

```bash
# Copy example environment file
cp .dev.vars.example .dev.vars

# Edit .dev.vars with your preferences
# At minimum, set ADMIN_API_KEY to a secure random string
nano .dev.vars
```

Example `.dev.vars`:
```
RSS_SCORE_THRESHOLD=5.0
MAX_CRAWL_DEPTH=2
RATE_LIMIT_REQUESTS=10
RATE_LIMIT_WINDOW=60
ADMIN_API_KEY=my-secret-key-12345
ENVIRONMENT=development
```

### Step 3: Start Development Server (1 minute)

```bash
# Start the local development server
npm run dev
```

You should see output like:
```
⛅️ wrangler 3.x.x
------------------
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

### Step 4: Test Basic Endpoints (4 minutes)

Open a new terminal and test the API:

#### Test 1: Health Check

```bash
curl http://localhost:8787/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "service": "Cloudflare Scraping Agent"
}
```

#### Test 2: Manual Scrape

```bash
curl -X POST http://localhost:8787/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "mode": "manual"
  }'
```

Expected response (partial):
```json
{
  "success": true,
  "job_id": "job_1234567890_abc123",
  "result": {
    "data": {
      "url": "https://example.com",
      "title": "Example Domain",
      "content": "...",
      "content_md": "..."
    }
  }
}
```

#### Test 3: Summary Generation

```bash
curl -X POST http://localhost:8787/api/summary \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "mode": "auto"
  }'
```

#### Test 4: Admin Stats

```bash
curl http://localhost:8787/api/admin/stats \
  -H "Authorization: Bearer my-secret-key-12345"
```

## Working with RSS Feeds

### Configure Your Feeds

Edit `config.json` to add your RSS feeds:

```json
{
  "rss_feeds": [
    {
      "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
      "name": "NY Times World",
      "enabled": true,
      "check_interval_hours": 6
    }
  ]
}
```

### Test RSS Checking

```bash
curl -X POST http://localhost:8787/api/rss \
  -H "Content-Type: application/json" \
  -d '{
    "feed_url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "threshold": 5.0
  }'
```

Expected response:
```json
{
  "success": true,
  "result": {
    "feed_url": "...",
    "feed_title": "NYT > World News",
    "total_items": 20,
    "high_score_items": [
      {
        "title": "...",
        "link": "...",
        "score": 7.5
      }
    ]
  }
}
```

## Understanding the Prophecy Scoring System

The scoring system analyzes content for theological keywords:

### High Priority Keywords (2x weight)
- "prophecy"
- "biblical prophecy"
- "end times"
- "revelation"

### Medium Priority Keywords (1x weight)
- "biblical"
- "eschatology"
- "messiah"
- "tribulation"
- etc.

### Example Score Calculation

Content: "Biblical prophecy about end times reveals..."

- "biblical" = 1.0 (medium)
- "prophecy" = 2.0 (high)
- "end times" = 2.0 (high)
- "revelation" = 2.0 (high)

**Total Score: 7.0** ✓ (Above threshold of 5.0)

### Customize Keywords

Edit `config.json` to add your own keywords:

```json
{
  "scoring": {
    "prophecy_keywords": [
      "prophecy",
      "biblical",
      "your-custom-keyword",
      "another-keyword"
    ],
    "high_priority_keywords": [
      "prophecy",
      "your-most-important-keyword"
    ],
    "threshold": 5.0
  }
}
```

## Deploying to Cloudflare

### Prerequisites

1. Create a Cloudflare account at https://dash.cloudflare.com
2. Authenticate Wrangler:
   ```bash
   wrangler login
   ```

### Quick Deploy (Without Database)

For a minimal deployment without R2/D1/KV:

1. Comment out bindings in `wrangler.toml`:
   ```toml
   # [[r2_buckets]]
   # ...
   # [[d1_databases]]
   # ...
   ```

2. Deploy:
   ```bash
   npm run deploy
   ```

3. Test your worker:
   ```bash
   curl https://your-worker.workers.dev/health
   ```

### Full Deploy (With Storage)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete setup with R2, D1, KV, and Queues.

## Common Use Cases

### Use Case 1: Monitor News Sites

**Goal**: Monitor multiple news RSS feeds for specific topics

```bash
# 1. Add feeds to config.json
# 2. Set keywords related to your topic
# 3. Test RSS endpoint
curl -X POST http://localhost:8787/api/rss \
  -H "Content-Type: application/json" \
  -d '{"feed_url": "https://your-feed.com/rss"}'
```

### Use Case 2: Archive Website Content

**Goal**: Scrape and archive specific pages

```bash
# Scrape single page
curl -X POST http://localhost:8787/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://important-article.com",
    "mode": "manual"
  }'

# Recursive crawl (depth 2)
curl -X POST http://localhost:8787/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://important-site.com",
    "mode": "auto",
    "depth": 2
  }'
```

### Use Case 3: Content Summarization

**Goal**: Get quick summaries of articles

```bash
curl -X POST http://localhost:8787/api/summary \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://long-article.com",
    "mode": "auto"
  }'
```

## Development Tips

### Viewing Logs

```bash
# In development, logs appear in the terminal
npm run dev

# In production, use:
npm run tail
```

### Testing Locally

```bash
# Use curl for quick tests
curl -X POST http://localhost:8787/api/crawl \
  -H "Content-Type: application/json" \
  -d @test-request.json

# Or use tools like Postman, Insomnia, etc.
```

### Debugging

Enable verbose logging in `src/index.js`:

```javascript
// Add at the top of request handler
console.log('Request:', {
  method: request.method,
  url: request.url,
  headers: Object.fromEntries(request.headers)
});
```

## Next Steps

1. **Customize Configuration**: Adjust `config.json` for your needs
2. **Add Your Feeds**: Configure RSS feeds you want to monitor
3. **Set Up Storage**: Follow [DEPLOYMENT.md](./DEPLOYMENT.md) to set up R2/D1
4. **Deploy to Production**: Deploy your worker to Cloudflare
5. **Monitor and Iterate**: Use admin endpoints to monitor performance

## Common Issues

### Issue: "Module not found"
**Solution**: Run `npm install`

### Issue: "Binding not found"
**Solution**: Either configure the binding in wrangler.toml or comment out references to it in code

### Issue: "Rate limit exceeded"
**Solution**: Adjust rate limits in wrangler.toml or wait for window to reset

### Issue: "CORS errors"
**Solution**: CORS is already configured in the worker - ensure you're not blocking from browser extensions

## Getting Help

- Check [README.md](./README.md) for full documentation
- Review [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment help
- Examine [schema.sql](./schema.sql) for database structure
- Check Cloudflare Workers documentation

## Sample Workflows

### Workflow 1: Daily News Monitoring

1. Configure RSS feeds in config.json
2. Deploy with cron trigger (every 6 hours)
3. High-scoring items auto-scrape
4. Review results via admin API
5. Export data weekly

### Workflow 2: Research Project

1. Collect URLs of interest
2. Manual crawl each URL
3. Generate summaries
4. Store in R2 as Markdown
5. Download for analysis

### Workflow 3: Content Archive

1. Recursive crawl important sites
2. Store in Postgres
3. Query database for analysis
4. Export to CSV periodically
5. Backup database monthly

Happy scraping!
