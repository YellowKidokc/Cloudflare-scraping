/**
 * Markdown Converter Module
 * Converts HTML/scraped content to structured Markdown
 */

/**
 * Convert scraped content to Markdown format
 */
export async function convertToMarkdown(scrapedData) {
  const { title, content, url, links, metadata, scraped_at } = scrapedData;

  let markdown = '';

  // Add frontmatter
  markdown += '---\n';
  markdown += `title: "${escapeYaml(title || 'Untitled')}"\n`;
  markdown += `url: "${url || ''}"\n`;
  markdown += `scraped_at: "${scraped_at || new Date().toISOString()}"\n`;

  if (metadata) {
    markdown += `method: "${metadata.method || 'unknown'}"\n`;
    if (metadata.contentType) {
      markdown += `content_type: "${metadata.contentType}"\n`;
    }
  }

  markdown += '---\n\n';

  // Add title
  if (title) {
    markdown += `# ${title}\n\n`;
  }

  // Add source URL
  if (url) {
    markdown += `**Source:** [${url}](${url})\n\n`;
  }

  // Add timestamp
  if (scraped_at) {
    const date = new Date(scraped_at);
    markdown += `**Scraped:** ${date.toLocaleString()}\n\n`;
  }

  // Add separator
  markdown += '---\n\n';

  // Add main content
  if (content) {
    // Clean and format content
    const cleanContent = cleanTextContent(content);
    markdown += `## Content\n\n${cleanContent}\n\n`;
  }

  // Add links section
  if (links && links.length > 0) {
    markdown += '## Links Found\n\n';
    const uniqueLinks = [...new Set(links)].slice(0, 50); // Limit to 50 unique links

    for (const link of uniqueLinks) {
      try {
        const linkUrl = new URL(link);
        markdown += `- [${linkUrl.hostname}${linkUrl.pathname}](${link})\n`;
      } catch {
        markdown += `- ${link}\n`;
      }
    }
    markdown += '\n';
  }

  // Add metadata footer
  if (metadata) {
    markdown += '---\n\n';
    markdown += '## Metadata\n\n';
    markdown += '```json\n';
    markdown += JSON.stringify(metadata, null, 2);
    markdown += '\n```\n';
  }

  return markdown;
}

/**
 * Clean text content for markdown
 */
function cleanTextContent(text) {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
    .replace(/[ \t]+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Escape YAML special characters
 */
function escapeYaml(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ');
}

/**
 * Generate summary from content
 */
export function generateSummary(content, maxLength = 500) {
  if (!content || content.length <= maxLength) {
    return content;
  }

  // Find a good breaking point (end of sentence)
  let summary = content.substring(0, maxLength);
  const lastPeriod = summary.lastIndexOf('.');
  const lastExclamation = summary.lastIndexOf('!');
  const lastQuestion = summary.lastIndexOf('?');

  const breakPoint = Math.max(lastPeriod, lastExclamation, lastQuestion);

  if (breakPoint > maxLength * 0.7) {
    summary = content.substring(0, breakPoint + 1);
  } else {
    summary = content.substring(0, maxLength) + '...';
  }

  return summary.trim();
}

/**
 * Extract key points from content using simple heuristics
 */
export function extractKeyPoints(content, maxPoints = 5) {
  // Split into sentences
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [];

  // Score sentences based on heuristics
  const scored = sentences.map(sentence => {
    let score = 0;

    // Longer sentences might be more informative
    if (sentence.length > 50 && sentence.length < 200) {
      score += 1;
    }

    // Sentences with numbers/data
    if (/\d+/.test(sentence)) {
      score += 1;
    }

    // Sentences near the beginning (often important)
    const index = sentences.indexOf(sentence);
    if (index < 3) {
      score += 1;
    }

    return { sentence: sentence.trim(), score };
  });

  // Sort by score and take top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPoints)
    .map(item => item.sentence);
}
