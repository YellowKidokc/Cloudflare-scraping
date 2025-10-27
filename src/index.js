/**
 * Cloudflare Workers Autonomous Scraper Agent
 * Main entrypoint with routing and request handling
 */

import { handleCrawl } from './modules/crawler.js';
import { handleRSS, checkRSSFeeds } from './modules/rss_handler.js';
import { handleSummary } from './modules/summarizer.js';
import { handleAdmin } from './modules/admin.js';
import { RateLimiter } from './utils/rate_limiter.js';
import CONFIG from '../config.json';

/**
 * Main Worker Request Handler
 */
export default {
  /**
   * Handle incoming HTTP requests
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Rate limiting
    const rateLimiter = new RateLimiter(env.CACHE);
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    const rateCheck = await rateLimiter.checkLimit(clientIP, {
      limit: parseInt(env.RSS_SCORE_THRESHOLD || '10'),
      window: 60
    });

    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        retry_after: rateCheck.reset_in
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      // Route handling
      if (path === '/' || path === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          version: '1.0.0',
          service: 'Cloudflare Scraping Agent',
          endpoints: [
            'POST /api/crawl - Manual crawl mode',
            'POST /api/rss - RSS feed check',
            'POST /api/summary - Summarize URL',
            'GET /api/admin/jobs - View jobs',
            'GET /api/admin/stats - View statistics'
          ]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Manual crawl endpoint
      if (path === '/api/crawl' && request.method === 'POST') {
        const body = await request.json();
        const result = await handleCrawl(body, env, ctx);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // RSS monitoring endpoint
      if (path === '/api/rss' && request.method === 'POST') {
        const body = await request.json();
        const result = await handleRSS(body, env, ctx);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Summary generation endpoint
      if (path === '/api/summary' && request.method === 'POST') {
        const body = await request.json();
        const result = await handleSummary(body, env, ctx);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Admin endpoints
      if (path.startsWith('/api/admin/')) {
        const result = await handleAdmin(path, request, env, ctx);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 404 for unknown routes
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'The requested endpoint does not exist'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Worker error:', error);

      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        stack: env.ENVIRONMENT === 'development' ? error.stack : undefined
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * Handle scheduled cron triggers
   */
  async scheduled(event, env, ctx) {
    console.log('Cron trigger fired:', event.cron);

    try {
      // Check all RSS feeds and auto-trigger high-scoring scrapes
      const result = await checkRSSFeeds(env, ctx);

      console.log('RSS check completed:', {
        feeds_checked: result.feeds_checked,
        high_score_items: result.high_score_items,
        scrapes_triggered: result.scrapes_triggered
      });

    } catch (error) {
      console.error('Scheduled task error:', error);
    }
  },

  /**
   * Handle queue messages (async scraping jobs)
   */
  async queue(batch, env) {
    console.log(`Processing batch of ${batch.messages.length} scrape jobs`);

    for (const message of batch.messages) {
      try {
        const job = message.body;
        console.log('Processing job:', job.id);

        // Process the scraping job
        const result = await handleCrawl({
          url: job.url,
          mode: job.mode || 'auto',
          depth: job.depth || 2,
          source: job.source || 'queue'
        }, env);

        // Store result
        if (result.success) {
          console.log('Job completed successfully:', job.id);
          message.ack();
        } else {
          console.error('Job failed:', job.id, result.error);
          message.retry();
        }

      } catch (error) {
        console.error('Queue processing error:', error);
        message.retry();
      }
    }
  }
};
