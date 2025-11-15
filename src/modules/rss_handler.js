/**
 * RSS Handler Module
 * Monitors RSS feeds and scores content based on prophecy keywords
 */

import { storeResult } from './storage.js';
import { handleCrawl } from './crawler.js';
import { isValidUrl, generateJobId } from '../utils/helpers.js';
import CONFIG from '../../config.json';

/**
 * Handle RSS feed check request
 */
export async function handleRSS(params, env, ctx) {
  const { feed_url, threshold } = params;

  if (!feed_url || !isValidUrl(feed_url)) {
    return {
      success: false,
      error: 'Invalid feed URL provided'
    };
  }

  const scoreThreshold = threshold || parseFloat(env.RSS_SCORE_THRESHOLD || '5.0');

  try {
    const result = await checkSingleFeed(feed_url, scoreThreshold, env, ctx);
    return {
      success: true,
      result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check all configured RSS feeds (called by cron)
 */
export async function checkRSSFeeds(env, ctx) {
  console.log('Starting scheduled RSS feed check');

  const feeds = CONFIG.rss_feeds.filter(f => f.enabled);
  const threshold = parseFloat(env.RSS_SCORE_THRESHOLD || '5.0');

  const results = {
    feeds_checked: 0,
    high_score_items: [],
    scrapes_triggered: 0,
    errors: []
  };

  for (const feed of feeds) {
    try {
      console.log(`Checking feed: ${feed.name} (${feed.url})`);

      const feedResult = await checkSingleFeed(feed.url, threshold, env, ctx);

      results.feeds_checked++;

      // Queue high-scoring items for scraping
      for (const item of feedResult.high_score_items) {
        console.log(`High-score item found (${item.score}): ${item.title}`);

        // Add to scraping queue
        await env.SCRAPE_QUEUE.send({
          id: generateJobId(),
          url: item.link,
          mode: 'manual',
          source: 'rss',
          feed_name: feed.name,
          score: item.score,
          title: item.title,
          timestamp: new Date().toISOString()
        });

        results.high_score_items.push(item);
        results.scrapes_triggered++;
      }

    } catch (error) {
      console.error(`Error checking feed ${feed.name}:`, error);
      results.errors.push({
        feed: feed.name,
        error: error.message
      });
    }
  }

  // Store RSS check results
  await storeResult({
    type: 'rss_check',
    timestamp: new Date().toISOString(),
    summary: results
  }, env, ctx);

  return results;
}

/**
 * Check a single RSS feed and score items
 */
async function checkSingleFeed(feedUrl, threshold, env, ctx) {
  console.log(`Fetching RSS feed: ${feedUrl}`);

  // Fetch the RSS feed
  const response = await fetch(feedUrl, {
    headers: {
      'User-Agent': CONFIG.scraper.user_agents[0],
      'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: HTTP ${response.status}`);
  }

  const xmlText = await response.text();
  const feed = parseRSSFeed(xmlText);

  console.log(`Parsed ${feed.items.length} items from feed`);

  // Score each item
  const scoredItems = feed.items.map(item => ({
    ...item,
    score: calculateProphecyScore(item)
  }));

  // Filter high-scoring items
  const highScoreItems = scoredItems.filter(item => item.score >= threshold);

  console.log(`Found ${highScoreItems.length} items with score >= ${threshold}`);

  return {
    feed_url: feedUrl,
    feed_title: feed.title,
    total_items: feed.items.length,
    high_score_items: highScoreItems,
    threshold,
    checked_at: new Date().toISOString()
  };
}

/**
 * Parse RSS/Atom feed XML
 */
function parseRSSFeed(xmlText) {
  const items = [];

  // Simple RSS parser (in production, use a proper XML parser)
  // This handles basic RSS 2.0 and Atom formats

  // Extract feed title
  const feedTitleMatch = xmlText.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
  const feedTitle = feedTitleMatch ? cleanText(feedTitleMatch[1]) : 'Untitled Feed';

  // Extract items/entries
  const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  const itemMatches = xmlText.matchAll(itemRegex);

  for (const itemMatch of itemMatches) {
    const itemXml = itemMatch[1];

    // Extract title
    const titleMatch = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
    const title = titleMatch ? cleanText(titleMatch[1]) : '';

    // Extract link
    const linkMatch = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i) ||
                     itemXml.match(/<link[^>]+href=["']([^"']+)["']/i);
    const link = linkMatch ? cleanText(linkMatch[1]) : '';

    // Extract description/content
    const descMatch = itemXml.match(/<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content)>/i);
    const description = descMatch ? cleanText(descMatch[1]) : '';

    // Extract publication date
    const dateMatch = itemXml.match(/<(?:pubDate|published|updated)[^>]*>([^<]+)<\/(?:pubDate|published|updated)>/i);
    const pubDate = dateMatch ? dateMatch[1].trim() : '';

    if (title && link) {
      items.push({
        title,
        link,
        description,
        pubDate,
        content: `${title} ${description}` // Combined text for scoring
      });
    }
  }

  return {
    title: feedTitle,
    items
  };
}

/**
 * Calculate prophecy score based on keywords
 */
function calculateProphecyScore(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const keywords = CONFIG.scoring.prophecy_keywords;
  const highPriorityKeywords = CONFIG.scoring.high_priority_keywords;

  let score = 0;

  // Check for keyword matches
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    const regex = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, 'gi');
    const matches = text.match(regex);

    if (matches) {
      const count = matches.length;
      const isHighPriority = highPriorityKeywords.some(hp =>
        hp.toLowerCase() === keywordLower
      );

      const weight = isHighPriority
        ? CONFIG.scoring.keyword_weights.high
        : CONFIG.scoring.keyword_weights.medium;

      score += count * weight;
    }
  }

  // Bonus for title matches
  const titleText = item.title.toLowerCase();
  for (const keyword of highPriorityKeywords) {
    if (titleText.includes(keyword.toLowerCase())) {
      score += 1.0;
    }
  }

  return parseFloat(score.toFixed(2));
}

/**
 * Clean text from HTML and XML entities
 */
function cleanText(text) {
  return text
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
