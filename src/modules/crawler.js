/**
 * Crawler Module - Adaptive Web Scraping
 * Supports multiple scraping strategies with automatic fallback
 */

import { storeResult } from './storage.js';
import { convertToMarkdown } from './markdown_converter.js';
import { extractDomain, isValidUrl, sleep, retry, generateJobId } from '../utils/helpers.js';
import CONFIG from '../../config.json';

/**
 * Main crawl handler
 */
export async function handleCrawl(params, env, ctx) {
  const {
    url,
    mode = 'manual',
    depth = 1,
    source = 'manual'
  } = params;

  // Validate URL
  if (!url || !isValidUrl(url)) {
    return {
      success: false,
      error: 'Invalid URL provided'
    };
  }

  const jobId = generateJobId();
  console.log(`Starting crawl job ${jobId}:`, { url, mode, depth });

  try {
    let result;

    if (mode === 'manual') {
      // Single URL scrape
      result = await scrapeSingleUrl(url, env);
    } else if (mode === 'auto') {
      // Recursive crawl
      result = await crawlRecursive(url, depth, env);
    } else {
      return {
        success: false,
        error: `Unknown mode: ${mode}`
      };
    }

    // Store results
    if (result.success) {
      const storageResult = await storeResult(result.data, env, ctx);
      result.storage = storageResult;
    }

    return {
      success: true,
      job_id: jobId,
      mode,
      source,
      result
    };

  } catch (error) {
    console.error('Crawl error:', error);
    return {
      success: false,
      job_id: jobId,
      error: error.message
    };
  }
}

/**
 * Scrape a single URL with adaptive strategy
 */
export async function scrapeSingleUrl(url, env) {
  console.log('Scraping URL:', url);

  // Check cache first
  const cached = await checkCache(url, env.CACHE);
  if (cached) {
    console.log('Cache hit for:', url);
    return {
      success: true,
      cached: true,
      data: cached
    };
  }

  // Try scraping strategies in order
  const strategies = [
    { name: 'fetch', fn: scrapeWithFetch },
    { name: 'puppeteer', fn: scrapeWithBrowser },
    { name: 'api', fn: scrapeWithAPI }
  ];

  let lastError;

  for (const strategy of strategies) {
    try {
      console.log(`Attempting strategy: ${strategy.name}`);
      const result = await strategy.fn(url, env);

      if (result && result.content) {
        // Convert to markdown
        const markdown = await convertToMarkdown(result);

        const data = {
          url,
          title: result.title,
          content: result.content,
          content_md: markdown,
          links: result.links || [],
          metadata: result.metadata || {},
          scraped_at: new Date().toISOString(),
          method: strategy.name
        };

        // Cache the result
        await cacheResult(url, data, env.CACHE);

        return {
          success: true,
          data
        };
      }
    } catch (error) {
      console.error(`Strategy ${strategy.name} failed:`, error.message);
      lastError = error;
    }
  }

  throw new Error(`All scraping strategies failed. Last error: ${lastError?.message}`);
}

/**
 * Strategy 1: Basic fetch with HTML parsing
 */
async function scrapeWithFetch(url, env) {
  const userAgent = CONFIG.scraper.user_agents[0];

  const response = await retry(async () => {
    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(CONFIG.scraper.timeout_ms)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return res;
  }, {
    maxRetries: CONFIG.scraper.max_retries
  });

  const html = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    throw new Error(`Unexpected content type: ${contentType}`);
  }

  // Parse HTML (simplified - in production, use cheerio or similar)
  const parsed = parseHTML(html);

  return {
    title: parsed.title,
    content: parsed.content,
    links: parsed.links,
    metadata: {
      contentType,
      contentLength: html.length
    }
  };
}

/**
 * Strategy 2: Browser rendering (Puppeteer/Browserless)
 * This would require Cloudflare Browser Rendering API or external service
 */
async function scrapeWithBrowser(url, env) {
  // Note: This requires Cloudflare Browser Rendering API
  // Or an external Puppeteer service
  // For now, we'll throw to move to next strategy

  throw new Error('Browser rendering not configured');

  // Example implementation with Browser Rendering API:
  /*
  const browser = await puppeteer.launch(env.MYBROWSER);
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });

  const content = await page.evaluate(() => {
    return {
      title: document.title,
      content: document.body.innerText,
      html: document.body.innerHTML
    };
  });

  await browser.close();
  return content;
  */
}

/**
 * Strategy 3: External API fallback
 */
async function scrapeWithAPI(url, env) {
  // Fallback to external scraping API (e.g., ScraperAPI, Apify, etc.)
  throw new Error('API scraping not configured');

  // Example:
  /*
  const apiUrl = `https://api.scraperapi.com?api_key=${env.SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
  const response = await fetch(apiUrl);
  const html = await response.text();
  return parseHTML(html);
  */
}

/**
 * Recursive crawling with depth limit
 */
async function crawlRecursive(startUrl, maxDepth, env) {
  const visited = new Set();
  const results = [];
  const domain = extractDomain(startUrl);
  const queue = [{ url: startUrl, depth: 0 }];

  console.log(`Starting recursive crawl from ${startUrl} with max depth ${maxDepth}`);

  while (queue.length > 0 && results.length < CONFIG.scraper.max_pages_per_domain) {
    const { url, depth } = queue.shift();

    // Skip if already visited or depth exceeded
    if (visited.has(url) || depth > maxDepth) {
      continue;
    }

    visited.add(url);

    try {
      // Scrape the page
      const result = await scrapeSingleUrl(url, env);

      if (result.success) {
        results.push(result.data);

        // Add links from this page to queue (only same domain)
        if (depth < maxDepth && result.data.links) {
          for (const link of result.data.links) {
            const linkDomain = extractDomain(link);
            if (linkDomain === domain && !visited.has(link)) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      }

      // Rate limiting delay
      await sleep(CONFIG.scraper.delay_between_requests_ms);

    } catch (error) {
      console.error(`Error crawling ${url}:`, error.message);
    }
  }

  return {
    success: true,
    data: {
      start_url: startUrl,
      pages_crawled: results.length,
      pages: results,
      max_depth: maxDepth
    }
  };
}

/**
 * Simple HTML parser (extract title, content, links)
 */
function parseHTML(html) {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

  // Remove script and style tags
  let cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Extract text content
  const content = cleanHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract links
  const linkMatches = html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi);
  const links = [...linkMatches]
    .map(match => match[1])
    .filter(link => isValidUrl(link))
    .slice(0, 50); // Limit to 50 links

  return {
    title,
    content: content.substring(0, 50000), // Limit content size
    links
  };
}

/**
 * Check cache for existing result
 */
async function checkCache(url, cache) {
  if (!cache) return null;

  try {
    const key = `scrape:${url}`;
    const cached = await cache.get(key, { type: 'json' });

    if (cached) {
      const age = Date.now() - new Date(cached.scraped_at).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (age < maxAge) {
        return cached;
      }
    }
  } catch (error) {
    console.error('Cache check error:', error);
  }

  return null;
}

/**
 * Cache scraping result
 */
async function cacheResult(url, data, cache) {
  if (!cache) return;

  try {
    const key = `scrape:${url}`;
    await cache.put(key, JSON.stringify(data), {
      expirationTtl: 24 * 60 * 60 // 24 hours
    });
  } catch (error) {
    console.error('Cache write error:', error);
  }
}
