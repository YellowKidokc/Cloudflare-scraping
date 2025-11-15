/**
 * Rate Limiter using Cloudflare KV
 */

export class RateLimiter {
  constructor(kvNamespace) {
    this.kv = kvNamespace;
  }

  /**
   * Check if a client has exceeded rate limits
   * @param {string} clientId - Client identifier (IP, API key, etc.)
   * @param {object} options - Rate limit options
   * @returns {Promise<{allowed: boolean, remaining: number, reset_in: number}>}
   */
  async checkLimit(clientId, options = {}) {
    const { limit = 10, window = 60 } = options;
    const key = `rate_limit:${clientId}`;
    const now = Date.now();

    try {
      // Get current count from KV
      const data = await this.kv.get(key, { type: 'json' });

      if (!data) {
        // First request - initialize
        await this.kv.put(key, JSON.stringify({
          count: 1,
          reset_at: now + (window * 1000)
        }), {
          expirationTtl: window
        });

        return {
          allowed: true,
          remaining: limit - 1,
          reset_in: window
        };
      }

      // Check if window has expired
      if (now >= data.reset_at) {
        // Reset counter
        await this.kv.put(key, JSON.stringify({
          count: 1,
          reset_at: now + (window * 1000)
        }), {
          expirationTtl: window
        });

        return {
          allowed: true,
          remaining: limit - 1,
          reset_in: window
        };
      }

      // Check if limit exceeded
      if (data.count >= limit) {
        const reset_in = Math.ceil((data.reset_at - now) / 1000);
        return {
          allowed: false,
          remaining: 0,
          reset_in
        };
      }

      // Increment counter
      data.count++;
      await this.kv.put(key, JSON.stringify(data), {
        expirationTtl: Math.ceil((data.reset_at - now) / 1000)
      });

      return {
        allowed: true,
        remaining: limit - data.count,
        reset_in: Math.ceil((data.reset_at - now) / 1000)
      };

    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open on errors
      return { allowed: true, remaining: limit, reset_in: window };
    }
  }
}
