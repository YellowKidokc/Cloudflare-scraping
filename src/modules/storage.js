/**
 * Storage Module
 * Handles data persistence to R2 and Postgres
 */

import { sanitizeFilename, getTimestamp, extractDomain } from '../utils/helpers.js';
import CONFIG from '../../config.json';

/**
 * Store scraping result to configured storage backend(s)
 */
export async function storeResult(data, env, ctx) {
  const results = {
    r2: null,
    postgres: null,
    metadata: null
  };

  try {
    // Store to R2 if enabled
    if (CONFIG.storage.r2.enabled && env.CRAWL_BUCKET) {
      results.r2 = await storeToR2(data, env.CRAWL_BUCKET);
    }

    // Store to Postgres if enabled
    if (CONFIG.storage.postgres.enabled) {
      results.postgres = await storeToPostgres(data, env);
    }

    // Store metadata to D1
    if (env.DB) {
      results.metadata = await storeMetadata(data, env.DB);
    }

    return {
      success: true,
      storage: results
    };

  } catch (error) {
    console.error('Storage error:', error);
    return {
      success: false,
      error: error.message,
      partial_results: results
    };
  }
}

/**
 * Store to Cloudflare R2
 */
async function storeToR2(data, bucket) {
  const timestamp = getTimestamp();
  const domain = data.url ? sanitizeFilename(extractDomain(data.url)) : 'unknown';

  // Store as JSON
  const jsonKey = `${CONFIG.storage.r2.bucket_prefix}${domain}/${timestamp}.json`;
  await bucket.put(jsonKey, JSON.stringify(data, null, 2), {
    httpMetadata: {
      contentType: 'application/json'
    },
    customMetadata: {
      url: data.url || '',
      scraped_at: data.scraped_at || new Date().toISOString(),
      type: data.type || 'scrape'
    }
  });

  // Store markdown version if available
  if (data.content_md) {
    const mdKey = `${CONFIG.storage.r2.bucket_prefix}${domain}/${timestamp}.md`;
    await bucket.put(mdKey, data.content_md, {
      httpMetadata: {
        contentType: 'text/markdown'
      }
    });
  }

  return {
    json_key: jsonKey,
    markdown_key: data.content_md ? `${CONFIG.storage.r2.bucket_prefix}${domain}/${timestamp}.md` : null,
    bucket: bucket.name || 'default'
  };
}

/**
 * Store to Postgres database
 */
async function storeToPostgres(data, env) {
  // Note: This requires a Postgres client library or HTTP endpoint
  // For Cloudflare Workers, you'd typically use:
  // 1. Hyperdrive for Postgres connections
  // 2. HTTP API to a Postgres-backed service
  // 3. External webhook to a service with Postgres access

  // Example with fetch to a Postgres HTTP endpoint:
  if (!CONFIG.storage.postgres.connection_string) {
    throw new Error('Postgres connection not configured');
  }

  // This is a placeholder - actual implementation depends on your setup
  const endpoint = env.POSTGRES_API_ENDPOINT;
  if (!endpoint) {
    console.warn('Postgres endpoint not configured, skipping');
    return { skipped: true };
  }

  const payload = {
    url: data.url,
    title: data.title,
    content: data.content,
    content_md: data.content_md,
    score: data.score || 0,
    scraped_at: data.scraped_at || new Date().toISOString(),
    metadata: JSON.stringify(data.metadata || {})
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.POSTGRES_API_KEY || ''}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Postgres API error: ${response.status}`);
  }

  const result = await response.json();
  return result;
}

/**
 * Store metadata to D1 (Cloudflare's SQLite)
 */
async function storeMetadata(data, db) {
  try {
    // Create table if not exists (idempotent)
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS scrape_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT,
        domain TEXT,
        score REAL DEFAULT 0,
        method TEXT,
        source TEXT,
        scraped_at TEXT NOT NULL,
        content_length INTEGER,
        links_count INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Insert metadata
    const domain = data.url ? extractDomain(data.url) : null;
    const result = await db.prepare(`
      INSERT INTO scrape_metadata (
        url, title, domain, score, method, source, scraped_at, content_length, links_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.url || '',
      data.title || '',
      domain,
      data.score || 0,
      data.method || 'unknown',
      data.source || 'manual',
      data.scraped_at || new Date().toISOString(),
      data.content?.length || 0,
      data.links?.length || 0
    ).run();

    return {
      inserted_id: result.meta.last_row_id,
      changes: result.meta.changes
    };

  } catch (error) {
    console.error('D1 metadata storage error:', error);
    throw error;
  }
}

/**
 * Retrieve scraping history from D1
 */
export async function getScrapingHistory(env, options = {}) {
  const {
    limit = 100,
    offset = 0,
    domain = null,
    min_score = null
  } = options;

  if (!env.DB) {
    throw new Error('Database not available');
  }

  let query = 'SELECT * FROM scrape_metadata WHERE 1=1';
  const params = [];

  if (domain) {
    query += ' AND domain = ?';
    params.push(domain);
  }

  if (min_score !== null) {
    query += ' AND score >= ?';
    params.push(min_score);
  }

  query += ' ORDER BY scraped_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...params).all();

  return {
    results: result.results,
    count: result.results.length
  };
}

/**
 * Get statistics from D1
 */
export async function getStatistics(env) {
  if (!env.DB) {
    throw new Error('Database not available');
  }

  // Total scrapes
  const totalResult = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM scrape_metadata'
  ).first();

  // Scrapes by domain
  const domainResult = await env.DB.prepare(`
    SELECT domain, COUNT(*) as count
    FROM scrape_metadata
    GROUP BY domain
    ORDER BY count DESC
    LIMIT 10
  `).all();

  // Recent high-scoring items
  const highScoreResult = await env.DB.prepare(`
    SELECT url, title, score, scraped_at
    FROM scrape_metadata
    WHERE score >= 5
    ORDER BY score DESC
    LIMIT 10
  `).all();

  return {
    total_scrapes: totalResult.count,
    top_domains: domainResult.results,
    high_score_items: highScoreResult.results
  };
}

/**
 * Export data to CSV format
 */
export function exportToCSV(data) {
  const headers = ['URL', 'Title', 'Score', 'Domain', 'Scraped At', 'Method'];
  const rows = data.map(item => [
    item.url,
    item.title?.replace(/,/g, ';') || '',
    item.score || 0,
    item.domain || '',
    item.scraped_at || '',
    item.method || ''
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csv;
}
