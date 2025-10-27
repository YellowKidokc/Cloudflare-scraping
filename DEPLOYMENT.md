# Deployment Guide

Complete guide for deploying the Cloudflare Scraping Agent to production.

## Prerequisites

- Node.js 18+ installed
- Cloudflare account with Workers enabled
- Wrangler CLI installed globally: `npm install -g wrangler`
- Git installed

## Step-by-Step Deployment

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd Cloudflare-scraping

# Install dependencies
npm install
```

### 2. Authenticate with Cloudflare

```bash
# Login to your Cloudflare account
wrangler login

# Verify authentication
wrangler whoami
```

### 3. Create Required Resources

#### R2 Bucket for Storage

```bash
# Create production bucket
wrangler r2 bucket create scraper-storage

# Create preview bucket (for development)
wrangler r2 bucket create scraper-storage-preview

# List buckets to verify
wrangler r2 bucket list
```

#### D1 Database for Metadata

```bash
# Create database
wrangler d1 create scraper-metadata

# Note the database ID from the output
# Update wrangler.toml with the database_id
```

#### KV Namespace for Caching

```bash
# Create production KV namespace
wrangler kv:namespace create CACHE

# Create preview namespace
wrangler kv:namespace create CACHE --preview

# Update wrangler.toml with the IDs
```

#### Queue for Async Jobs

```bash
# Create queue
wrangler queues create scraper-jobs

# Verify creation
wrangler queues list
```

### 4. Configure wrangler.toml

Update `wrangler.toml` with your resource IDs:

```toml
# Update these with your actual IDs
[[d1_databases]]
binding = "DB"
database_name = "scraper-metadata"
database_id = "your-actual-database-id"  # ← Update this

[[kv_namespaces]]
binding = "CACHE"
id = "your-actual-kv-id"  # ← Update this
preview_id = "your-actual-preview-id"  # ← Update this

# R2 buckets should already be configured correctly
```

### 5. Set Environment Variables

Create a `.dev.vars` file for local development:

```bash
cat > .dev.vars << EOF
RSS_SCORE_THRESHOLD=5.0
MAX_CRAWL_DEPTH=3
RATE_LIMIT_REQUESTS=10
RATE_LIMIT_WINDOW=60
ADMIN_API_KEY=your-secure-admin-key-here
OPENAI_API_KEY=sk-your-key-if-using-openai
POSTGRES_API_ENDPOINT=https://your-postgres-api.com
POSTGRES_API_KEY=your-postgres-key
EOF
```

For production, set secrets using wrangler:

```bash
# Set admin API key
wrangler secret put ADMIN_API_KEY
# Enter your secure key when prompted

# Set OpenAI API key (if using)
wrangler secret put OPENAI_API_KEY

# Set Postgres credentials (if using)
wrangler secret put POSTGRES_API_ENDPOINT
wrangler secret put POSTGRES_API_KEY
```

### 6. Configure RSS Feeds

Edit `config.json` and add your RSS feed sources:

```json
{
  "rss_feeds": [
    {
      "url": "https://your-feed-1.com/rss",
      "name": "Feed Name 1",
      "enabled": true,
      "check_interval_hours": 6
    },
    {
      "url": "https://your-feed-2.com/rss",
      "name": "Feed Name 2",
      "enabled": true,
      "check_interval_hours": 12
    }
  ],
  "scoring": {
    "prophecy_keywords": [
      "prophecy",
      "biblical",
      "revelation",
      "eschatology",
      "end times",
      "jerusalem",
      "israel"
    ],
    "threshold": 5.0
  }
}
```

### 7. Test Locally

```bash
# Start local development server
npm run dev

# In another terminal, test the endpoints
curl http://localhost:8787/health

# Test manual crawl
curl -X POST http://localhost:8787/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "mode": "manual"}'
```

### 8. Deploy to Production

```bash
# Deploy to production
npm run deploy

# Or deploy to staging first
wrangler deploy --env staging
```

### 9. Set Up Postgres (Optional)

If using Postgres for storage:

```bash
# Connect to your Postgres instance
psql -U your_user -h your_host -d your_database

# Run the schema
\i schema.sql

# Verify tables created
\dt

# Verify views created
\dv
```

### 10. Verify Deployment

```bash
# Check deployment status
wrangler deployments list

# View live logs
npm run tail

# Test production endpoint
curl https://your-worker.workers.dev/health
```

### 11. Configure Cron Triggers

Cron triggers are already configured in `wrangler.toml`:

```toml
[triggers]
crons = ["0 */6 * * *"]  # Runs every 6 hours
```

To verify cron is working:

```bash
# Check scheduled events in the dashboard
# Or watch logs during scheduled run time
wrangler tail --format pretty
```

## Post-Deployment Configuration

### 1. Test RSS Feed Monitoring

```bash
# Manually trigger RSS check
curl -X POST https://your-worker.workers.dev/api/rss \
  -H "Content-Type: application/json" \
  -d '{
    "feed_url": "https://your-feed.com/rss",
    "threshold": 5.0
  }'
```

### 2. Configure Admin Access

```bash
# Test admin endpoints
curl https://your-worker.workers.dev/api/admin/stats \
  -H "Authorization: Bearer your-admin-key"

# View job history
curl https://your-worker.workers.dev/api/admin/jobs?limit=10 \
  -H "Authorization: Bearer your-admin-key"
```

### 3. Monitor Performance

```bash
# View real-time logs
wrangler tail --format pretty

# Check analytics in Cloudflare Dashboard:
# Workers & Pages → Your Worker → Metrics
```

## Cloudflare Dashboard Configuration

### 1. Custom Domain (Optional)

1. Go to Workers & Pages → Your Worker
2. Click "Triggers" tab
3. Click "Add Custom Domain"
4. Enter your domain (e.g., `scraper.yourdomain.com`)
5. Follow DNS configuration steps

### 2. Environment Variables

You can also manage environment variables in the dashboard:

1. Workers & Pages → Your Worker
2. Settings → Variables
3. Add/edit variables
4. Click "Save and Deploy"

### 3. Analytics and Monitoring

Enable detailed analytics:

1. Workers & Pages → Your Worker → Metrics
2. Enable "Workers Analytics Engine" (if available)
3. Set up alerts for errors/rate limits

## Scaling Considerations

### 1. Rate Limiting

Adjust based on your needs:

```toml
[vars]
RATE_LIMIT_REQUESTS = "100"  # Increase for higher traffic
RATE_LIMIT_WINDOW = "60"
```

### 2. Queue Configuration

For high-volume scraping:

```toml
[[queues.consumers]]
queue = "scraper-jobs"
max_batch_size = 50  # Process more jobs per batch
max_batch_timeout = 60
max_retries = 5
```

### 3. Cron Frequency

Adjust RSS check frequency:

```toml
[triggers]
crons = ["0 */3 * * *"]  # Every 3 hours instead of 6
```

### 4. Storage Optimization

For R2 storage management:

```bash
# List objects
wrangler r2 object list scraper-storage --prefix crawls/

# Set lifecycle policies in dashboard to auto-delete old data
```

## Troubleshooting Deployment

### Issue: Database ID not found

```bash
# Recreate database
wrangler d1 create scraper-metadata

# Update wrangler.toml with new ID
```

### Issue: KV namespace errors

```bash
# List namespaces
wrangler kv:namespace list

# Verify IDs match wrangler.toml
```

### Issue: Queue not receiving messages

```bash
# Check queue exists
wrangler queues list

# View queue details
wrangler queues consumer get scraper-jobs

# Check worker bindings in wrangler.toml
```

### Issue: Secrets not accessible

```bash
# List secrets
wrangler secret list

# Re-add missing secret
wrangler secret put ADMIN_API_KEY
```

### Issue: Cron not firing

- Verify cron syntax in wrangler.toml
- Check worker logs during expected trigger time
- Ensure worker is deployed (not just in development)

## Security Best Practices

1. **Rotate API Keys**: Change admin API key periodically
   ```bash
   wrangler secret put ADMIN_API_KEY
   ```

2. **Restrict Admin Access**: Use IP filtering or Cloudflare Access

3. **Monitor Usage**: Set up alerts for unusual activity

4. **Rate Limiting**: Ensure rate limits are appropriate

5. **Secrets Management**: Never commit secrets to git

## Monitoring and Maintenance

### Set Up Alerts

In Cloudflare Dashboard:
1. Notifications → Add
2. Select "Worker errors exceeding threshold"
3. Configure alert recipients

### Regular Maintenance

```bash
# Weekly: Check statistics
curl https://your-worker.workers.dev/api/admin/stats \
  -H "Authorization: Bearer your-admin-key"

# Monthly: Export data
curl https://your-worker.workers.dev/api/admin/export \
  -H "Authorization: Bearer your-admin-key" > backup.csv

# As needed: Clear cache
# Implement cache clearing endpoint or let TTL expire
```

### Database Backups (Postgres)

```bash
# Backup Postgres database
pg_dump -U your_user your_database > backup-$(date +%Y%m%d).sql

# Restore if needed
psql -U your_user your_database < backup-20240101.sql
```

### R2 Backups

```bash
# Download all R2 objects (for backup)
wrangler r2 object list scraper-storage | \
  while read file; do
    wrangler r2 object get scraper-storage/$file --file backup/$file
  done
```

## Updating the Worker

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Test locally
npm run dev

# Deploy update
npm run deploy

# Verify deployment
wrangler deployments list
```

## Rollback Procedure

If a deployment causes issues:

```bash
# List recent deployments
wrangler deployments list

# View specific deployment
wrangler deployments view <deployment-id>

# Rollback to previous version
wrangler rollback <deployment-id>
```

## Support and Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Community Discord](https://discord.gg/cloudflaredev)
- [GitHub Issues](https://github.com/your-repo/issues)

## Next Steps

After successful deployment:

1. Configure your RSS feeds in `config.json`
2. Set up Postgres database (if using)
3. Test all endpoints thoroughly
4. Monitor logs for the first 24 hours
5. Set up custom domain (optional)
6. Configure alerts and monitoring
7. Document your specific configuration for your team
