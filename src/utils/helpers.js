/**
 * Utility Helper Functions
 */

/**
 * Generate a unique job ID
 */
export function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract domain from URL
 */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * Validate URL format
 */
export function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sleep utility for delays
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(name) {
  return name
    .replace(/[^a-z0-9-_]/gi, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

/**
 * Format timestamp for filenames
 */
export function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Truncate text to max length
 */
export function truncate(text, maxLength = 200) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Calculate text similarity (simple Jaccard similarity)
 */
export function calculateSimilarity(text1, text2) {
  const set1 = new Set(text1.toLowerCase().split(/\s+/));
  const set2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Extract text content from HTML
 */
export function extractText(html) {
  // Simple HTML tag removal
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Create error response object
 */
export function createErrorResponse(error, statusCode = 500) {
  return {
    success: false,
    error: error.message || error,
    status: statusCode,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create success response object
 */
export function createSuccessResponse(data) {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Retry logic with exponential backoff
 */
export async function retry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms:`, error.message);

      if (i < maxRetries - 1) {
        await sleep(delay);
        delay = Math.min(delay * backoffFactor, maxDelay);
      }
    }
  }

  throw lastError;
}
