/**
 * Admin Module
 * Handles admin endpoints for monitoring and management
 */

import { getScrapingHistory, getStatistics, exportToCSV } from './storage.js';

/**
 * Handle admin requests
 */
export async function handleAdmin(path, request, env, ctx) {
  const method = request.method;

  // Admin authentication (simple check - enhance in production)
  const authHeader = request.headers.get('Authorization');
  const expectedAuth = `Bearer ${env.ADMIN_API_KEY || 'admin-secret-key'}`;

  if (authHeader !== expectedAuth) {
    return {
      error: 'Unauthorized',
      message: 'Invalid or missing API key'
    };
  }

  try {
    // GET /api/admin/jobs - View job history
    if (path === '/api/admin/jobs' && method === 'GET') {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const domain = url.searchParams.get('domain') || null;

      const history = await getScrapingHistory(env, { limit, offset, domain });

      return {
        success: true,
        jobs: history.results,
        count: history.count,
        pagination: {
          limit,
          offset,
          has_more: history.count === limit
        }
      };
    }

    // GET /api/admin/stats - View statistics
    if (path === '/api/admin/stats' && method === 'GET') {
      const stats = await getStatistics(env);

      return {
        success: true,
        statistics: stats,
        timestamp: new Date().toISOString()
      };
    }

    // GET /api/admin/export - Export data as CSV
    if (path === '/api/admin/export' && method === 'GET') {
      const history = await getScrapingHistory(env, { limit: 10000 });
      const csv = exportToCSV(history.results);

      // Return CSV file
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="scraping-data-${Date.now()}.csv"`
        }
      });
    }

    // GET /api/admin/config - View current configuration
    if (path === '/api/admin/config' && method === 'GET') {
      return {
        success: true,
        config: {
          rss_score_threshold: env.RSS_SCORE_THRESHOLD,
          max_crawl_depth: env.MAX_CRAWL_DEPTH,
          rate_limit_requests: env.RATE_LIMIT_REQUESTS,
          rate_limit_window: env.RATE_LIMIT_WINDOW,
          environment: env.ENVIRONMENT
        }
      };
    }

    // GET /api/admin/health - Detailed health check
    if (path === '/api/admin/health' && method === 'GET') {
      const health = {
        status: 'healthy',
        services: {
          r2: !!env.CRAWL_BUCKET,
          database: !!env.DB,
          cache: !!env.CACHE,
          queue: !!env.SCRAPE_QUEUE
        },
        timestamp: new Date().toISOString()
      };

      // Test database connection
      if (env.DB) {
        try {
          await env.DB.prepare('SELECT 1').first();
          health.services.database = 'connected';
        } catch {
          health.services.database = 'error';
          health.status = 'degraded';
        }
      }

      return {
        success: true,
        health
      };
    }

    // POST /api/admin/clear-cache - Clear cache
    if (path === '/api/admin/clear-cache' && method === 'POST') {
      // Note: Cloudflare KV doesn't support bulk delete easily
      // You'd need to track keys separately or use a different approach

      return {
        success: true,
        message: 'Cache clear initiated (implementation pending)'
      };
    }

    // DELETE /api/admin/jobs/:id - Delete a specific job
    if (path.match(/^\/api\/admin\/jobs\/\d+$/) && method === 'DELETE') {
      const jobId = path.split('/').pop();

      if (env.DB) {
        await env.DB.prepare(
          'DELETE FROM scrape_metadata WHERE id = ?'
        ).bind(jobId).run();

        return {
          success: true,
          message: `Job ${jobId} deleted`
        };
      }

      return {
        success: false,
        error: 'Database not available'
      };
    }

    return {
      error: 'Not Found',
      message: 'Unknown admin endpoint'
    };

  } catch (error) {
    console.error('Admin error:', error);
    return {
      error: 'Internal Server Error',
      message: error.message
    };
  }
}
