# API Examples

Comprehensive examples for using the Cloudflare Scraping Agent API.

## Table of Contents

- [Authentication](#authentication)
- [Crawling Examples](#crawling-examples)
- [RSS Feed Examples](#rss-feed-examples)
- [Summarization Examples](#summarization-examples)
- [Admin Examples](#admin-examples)
- [Advanced Workflows](#advanced-workflows)

## Authentication

Most endpoints don't require authentication, but admin endpoints do:

```bash
# Set your API key
export ADMIN_KEY="your-admin-api-key"

# Use in requests
curl https://your-worker.workers.dev/api/admin/stats \
  -H "Authorization: Bearer $ADMIN_KEY"
```

## Crawling Examples

### Example 1: Simple Page Scrape

```bash
curl -X POST https://your-worker.workers.dev/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "mode": "manual"
  }'
```

**Response:**
```json
{
  "success": true,
  "job_id": "job_1234567890_abc123",
  "mode": "manual",
  "source": "manual",
  "result": {
    "success": true,
    "data": {
      "url": "https://example.com",
      "title": "Example Domain",
      "content": "This domain is for use in illustrative examples...",
      "content_md": "# Example Domain\n\n**Source:** [https://example.com]...",
      "links": ["https://www.iana.org/domains/example"],
      "metadata": {
        "contentType": "text/html",
        "contentLength": 1256
      },
      "scraped_at": "2024-01-15T10:30:00.000Z",
      "method": "fetch"
    }
  }
}
```

### Example 2: Recursive Crawl

Crawl a website and all linked pages up to depth 2:

```bash
curl -X POST https://your-worker.workers.dev/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://blog.example.com",
    "mode": "auto",
    "depth": 2
  }'
```

**Response:**
```json
{
  "success": true,
  "job_id": "job_1234567890_xyz789",
  "mode": "auto",
  "result": {
    "success": true,
    "data": {
      "start_url": "https://blog.example.com",
      "pages_crawled": 15,
      "max_depth": 2,
      "pages": [
        {
          "url": "https://blog.example.com",
          "title": "Blog Home",
          "content": "...",
          "links": [...]
        },
        {
          "url": "https://blog.example.com/post-1",
          "title": "Post 1",
          "content": "...",
          "links": [...]
        }
      ]
    }
  }
}
```

### Example 3: Scrape with Source Tracking

```bash
curl -X POST https://your-worker.workers.dev/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://news.example.com/article",
    "mode": "manual",
    "source": "email-newsletter"
  }'
```

## RSS Feed Examples

### Example 4: Check Single RSS Feed

```bash
curl -X POST https://your-worker.workers.dev/api/rss \
  -H "Content-Type: application/json" \
  -d '{
    "feed_url": "https://example.com/feed.xml",
    "threshold": 5.0
  }'
```

**Response:**
```json
{
  "success": true,
  "result": {
    "feed_url": "https://example.com/feed.xml",
    "feed_title": "Example News Feed",
    "total_items": 25,
    "high_score_items": [
      {
        "title": "Biblical Prophecy Fulfillment in Modern Times",
        "link": "https://example.com/article-1",
        "description": "Analysis of recent events...",
        "pubDate": "Mon, 15 Jan 2024 10:00:00 GMT",
        "score": 8.5,
        "content": "..."
      },
      {
        "title": "End Times Eschatology: A Theological Perspective",
        "link": "https://example.com/article-2",
        "description": "Deep dive into...",
        "pubDate": "Sun, 14 Jan 2024 15:30:00 GMT",
        "score": 7.0,
        "content": "..."
      }
    ],
    "threshold": 5.0,
    "checked_at": "2024-01-15T12:00:00.000Z"
  }
}
```

### Example 5: RSS Feed with Custom Threshold

Lower threshold to catch more items:

```bash
curl -X POST https://your-worker.workers.dev/api/rss \
  -H "Content-Type: application/json" \
  -d '{
    "feed_url": "https://example.com/feed.xml",
    "threshold": 3.0
  }'
```

## Summarization Examples

### Example 6: Auto Summary from URL

```bash
curl -X POST https://your-worker.workers.dev/api/summary \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/long-article",
    "mode": "auto"
  }'
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "summary": "This article discusses the intersection of biblical prophecy and modern geopolitics. Key themes include the role of Jerusalem, regional conflicts, and theological interpretations of current events.",
    "key_points": [
      "Jerusalem remains central to prophetic discussions",
      "Recent political developments align with certain interpretations",
      "Theological perspectives vary across traditions"
    ]
  },
  "metadata": {
    "url": "https://example.com/long-article",
    "title": "Modern Prophecy Analysis",
    "source": "url"
  },
  "generated_at": "2024-01-15T12:30:00.000Z"
}
```

### Example 7: AI-Powered Summary

Using AI for deeper analysis (requires OpenAI API key):

```bash
curl -X POST https://your-worker.workers.dev/api/summary \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "mode": "ai"
  }'
```

### Example 8: Summarize Direct Text

```bash
curl -X POST https://your-worker.workers.dev/api/summary \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your long text content here to be summarized...",
    "mode": "auto"
  }'
```

## Admin Examples

### Example 9: View Job History

```bash
curl https://your-worker.workers.dev/api/admin/jobs?limit=10&offset=0 \
  -H "Authorization: Bearer $ADMIN_KEY"
```

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "id": 1,
      "url": "https://example.com",
      "title": "Example Domain",
      "domain": "example.com",
      "score": 3.5,
      "method": "fetch",
      "source": "manual",
      "scraped_at": "2024-01-15T10:00:00.000Z"
    }
  ],
  "count": 10,
  "pagination": {
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

### Example 10: View Statistics

```bash
curl https://your-worker.workers.dev/api/admin/stats \
  -H "Authorization: Bearer $ADMIN_KEY"
```

**Response:**
```json
{
  "success": true,
  "statistics": {
    "total_scrapes": 1547,
    "top_domains": [
      { "domain": "example.com", "count": 234 },
      { "domain": "news.example.org", "count": 189 }
    ],
    "high_score_items": [
      {
        "url": "https://example.com/high-score",
        "title": "Important Article",
        "score": 12.5,
        "scraped_at": "2024-01-15T08:00:00.000Z"
      }
    ]
  },
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

### Example 11: Export Data as CSV

```bash
curl https://your-worker.workers.dev/api/admin/export \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -o export.csv
```

**Result:** Downloads CSV file with all scraping data

### Example 12: Health Check

```bash
curl https://your-worker.workers.dev/api/admin/health \
  -H "Authorization: Bearer $ADMIN_KEY"
```

**Response:**
```json
{
  "success": true,
  "health": {
    "status": "healthy",
    "services": {
      "r2": true,
      "database": "connected",
      "cache": true,
      "queue": true
    },
    "timestamp": "2024-01-15T12:00:00.000Z"
  }
}
```

### Example 13: Filter Jobs by Domain

```bash
curl "https://your-worker.workers.dev/api/admin/jobs?domain=example.com&limit=50" \
  -H "Authorization: Bearer $ADMIN_KEY"
```

## Advanced Workflows

### Workflow 1: Batch URL Processing

Process multiple URLs using a shell script:

```bash
#!/bin/bash
# batch-scrape.sh

urls=(
  "https://example.com/page1"
  "https://example.com/page2"
  "https://example.com/page3"
)

for url in "${urls[@]}"; do
  echo "Scraping: $url"
  curl -X POST https://your-worker.workers.dev/api/crawl \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$url\", \"mode\": \"manual\"}" \
    -s | jq .
  sleep 2  # Rate limiting
done
```

### Workflow 2: Monitor RSS and Auto-Scrape

Using Python:

```python
import requests
import time

WORKER_URL = "https://your-worker.workers.dev"
RSS_FEED = "https://example.com/feed.xml"
THRESHOLD = 5.0

def check_and_scrape():
    # Check RSS feed
    response = requests.post(f"{WORKER_URL}/api/rss", json={
        "feed_url": RSS_FEED,
        "threshold": THRESHOLD
    })

    result = response.json()
    high_score_items = result.get("result", {}).get("high_score_items", [])

    print(f"Found {len(high_score_items)} high-scoring items")

    # Scrape each high-scoring item
    for item in high_score_items:
        print(f"Scraping: {item['title']} (score: {item['score']})")

        scrape_response = requests.post(f"{WORKER_URL}/api/crawl", json={
            "url": item["link"],
            "mode": "manual",
            "source": "rss-auto"
        })

        print(f"Result: {scrape_response.json()['success']}")
        time.sleep(1)

# Run every hour
while True:
    check_and_scrape()
    time.sleep(3600)
```

### Workflow 3: Generate Weekly Report

```bash
#!/bin/bash
# weekly-report.sh

WORKER_URL="https://your-worker.workers.dev"
ADMIN_KEY="your-admin-key"
DATE=$(date +%Y-%m-%d)

# Get statistics
echo "Weekly Scraping Report - $DATE" > report-$DATE.txt
echo "================================" >> report-$DATE.txt
echo "" >> report-$DATE.txt

curl "$WORKER_URL/api/admin/stats" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -s | jq . >> report-$DATE.txt

echo "" >> report-$DATE.txt
echo "Top 100 Recent Jobs" >> report-$DATE.txt
echo "==================" >> report-$DATE.txt

curl "$WORKER_URL/api/admin/jobs?limit=100" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -s | jq '.jobs[] | {url, title, score, scraped_at}' >> report-$DATE.txt

# Export CSV
curl "$WORKER_URL/api/admin/export" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -o "export-$DATE.csv"

echo "Report generated: report-$DATE.txt"
echo "Export generated: export-$DATE.csv"
```

### Workflow 4: Integration with Postgres

Query scraped data from Postgres:

```sql
-- Get all high-scoring items from last 7 days
SELECT
  url,
  title,
  score,
  scraped_at
FROM prophecy_feeds
WHERE score >= 5
  AND scraped_at > NOW() - INTERVAL '7 days'
ORDER BY score DESC;

-- Get scraping statistics by domain
SELECT
  domain,
  COUNT(*) as total_scrapes,
  AVG(score) as avg_score,
  MAX(score) as max_score,
  MAX(scraped_at) as last_scraped
FROM prophecy_feeds
GROUP BY domain
ORDER BY total_scrapes DESC;

-- Find items with specific keywords
SELECT
  pf.url,
  pf.title,
  km.keyword,
  km.match_count
FROM prophecy_feeds pf
JOIN keyword_matches km ON pf.id = km.scrape_id
WHERE km.keyword IN ('prophecy', 'revelation', 'end times')
ORDER BY km.match_count DESC;
```

### Workflow 5: Automated Content Curation

Combine scraping with content filtering:

```javascript
// node automation.js
const axios = require('axios');

const WORKER_URL = 'https://your-worker.workers.dev';
const MIN_SCORE = 7.0;

async function curateContent() {
  // Get recent high-scoring items
  const statsResponse = await axios.get(
    `${WORKER_URL}/api/admin/stats`,
    {
      headers: { Authorization: 'Bearer your-admin-key' }
    }
  );

  const highScoreItems = statsResponse.data.statistics.high_score_items;

  // Filter by score
  const curated = highScoreItems.filter(item => item.score >= MIN_SCORE);

  // Generate summaries for curated items
  for (const item of curated) {
    const summaryResponse = await axios.post(
      `${WORKER_URL}/api/summary`,
      { url: item.url, mode: 'auto' }
    );

    console.log(`\n${item.title} (Score: ${item.score})`);
    console.log(summaryResponse.data.summary.summary);
    console.log('---');
  }
}

curateContent();
```

## Error Handling

### Example: Handle Rate Limiting

```bash
# Response when rate limited
{
  "error": "Rate limit exceeded",
  "retry_after": 45
}
```

**Handle in script:**
```bash
response=$(curl -s -w "\n%{http_code}" -X POST ...)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 429 ]; then
  retry_after=$(echo "$body" | jq -r '.retry_after')
  echo "Rate limited, waiting $retry_after seconds..."
  sleep $retry_after
  # Retry request
fi
```

### Example: Handle Scraping Failures

```javascript
async function scrapeWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.post(`${WORKER_URL}/api/crawl`, {
        url,
        mode: 'manual'
      });

      if (response.data.success) {
        return response.data;
      }
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error.message);
      if (i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000); // Exponential backoff
      }
    }
  }
  throw new Error('All retries failed');
}
```

## Testing

### Example: Integration Test

```bash
#!/bin/bash
# integration-test.sh

echo "Running integration tests..."

# Test 1: Health check
echo "Test 1: Health check"
curl -s http://localhost:8787/health | jq .status

# Test 2: Manual scrape
echo "Test 2: Manual scrape"
curl -s -X POST http://localhost:8787/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "mode": "manual"}' \
  | jq .success

# Test 3: Summary
echo "Test 3: Summary generation"
curl -s -X POST http://localhost:8787/api/summary \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "mode": "auto"}' \
  | jq .success

echo "Tests complete!"
```

## More Examples

For more examples and use cases, see:
- [README.md](./README.md) - Main documentation
- [TUTORIAL.md](./TUTORIAL.md) - Step-by-step tutorial
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
