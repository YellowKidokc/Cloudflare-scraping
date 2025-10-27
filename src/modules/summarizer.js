/**
 * AI Summarization Module
 * Uses AI models to generate intelligent summaries of scraped content
 */

import { scrapeSingleUrl } from './crawler.js';
import { generateSummary, extractKeyPoints } from './markdown_converter.js';
import { isValidUrl } from '../utils/helpers.js';
import CONFIG from '../../config.json';

/**
 * Handle summary generation request
 */
export async function handleSummary(params, env, ctx) {
  const { url, text, mode = 'auto' } = params;

  try {
    let content;
    let metadata = {};

    // Get content either from URL or direct text
    if (url && isValidUrl(url)) {
      // Scrape URL first
      const scrapeResult = await scrapeSingleUrl(url, env);
      if (!scrapeResult.success) {
        throw new Error('Failed to scrape URL');
      }
      content = scrapeResult.data.content;
      metadata = {
        url,
        title: scrapeResult.data.title,
        source: 'url'
      };
    } else if (text) {
      content = text;
      metadata = { source: 'text' };
    } else {
      throw new Error('Either url or text must be provided');
    }

    // Generate summary based on mode
    let summary;
    if (mode === 'ai' && CONFIG.ai_summarization.enabled) {
      // Use AI model for summarization
      summary = await generateAISummary(content, env);
    } else {
      // Use extractive summarization (simple)
      summary = {
        summary: generateSummary(content, CONFIG.ai_summarization.max_summary_length),
        key_points: CONFIG.ai_summarization.include_key_points
          ? extractKeyPoints(content)
          : []
      };
    }

    return {
      success: true,
      summary,
      metadata,
      generated_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('Summarization error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate AI-powered summary using LLM
 */
async function generateAISummary(content, env) {
  // This can integrate with various AI services:
  // 1. Cloudflare AI Workers (Workers AI)
  // 2. OpenAI API
  // 3. Anthropic Claude API
  // 4. Local models via Cloudflare Browser Rendering

  // Example with Cloudflare AI Workers:
  if (env.AI) {
    return await generateWithCloudflareAI(content, env.AI);
  }

  // Example with OpenAI:
  if (env.OPENAI_API_KEY) {
    return await generateWithOpenAI(content, env.OPENAI_API_KEY);
  }

  // Fallback to extractive summary
  console.warn('No AI service configured, using extractive summary');
  return {
    summary: generateSummary(content, 500),
    key_points: extractKeyPoints(content),
    method: 'extractive'
  };
}

/**
 * Generate summary using Cloudflare AI Workers
 */
async function generateWithCloudflareAI(content, ai) {
  try {
    // Truncate content if too long
    const maxLength = 4000;
    const truncatedContent = content.length > maxLength
      ? content.substring(0, maxLength) + '...'
      : content;

    // Use Cloudflare AI for summarization
    const response = await ai.run('@cf/facebook/bart-large-cnn', {
      input_text: truncatedContent,
      max_length: 500
    });

    return {
      summary: response.summary,
      method: 'cloudflare-ai',
      model: '@cf/facebook/bart-large-cnn'
    };

  } catch (error) {
    console.error('Cloudflare AI error:', error);
    throw error;
  }
}

/**
 * Generate summary using OpenAI API
 */
async function generateWithOpenAI(content, apiKey) {
  try {
    const maxLength = 4000;
    const truncatedContent = content.length > maxLength
      ? content.substring(0, maxLength) + '...'
      : content;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise summaries of articles and web content. Focus on key points and main ideas.'
          },
          {
            role: 'user',
            content: `Please summarize the following content in 3-5 bullet points:\n\n${truncatedContent}`
          }
        ],
        max_tokens: 500,
        temperature: 0.5
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;

    // Extract bullet points
    const bulletPoints = summary
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map(line => line.replace(/^[-•]\s*/, '').trim());

    return {
      summary: summary,
      key_points: bulletPoints,
      method: 'openai',
      model: 'gpt-3.5-turbo',
      tokens_used: data.usage.total_tokens
    };

  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

/**
 * Generate theological/prophetic analysis
 */
export async function analyzePropheticContent(content, env) {
  // This could use a specialized AI model or prompt
  // to identify prophetic themes and connections

  const prophecyKeywords = CONFIG.scoring.prophecy_keywords;

  // Extract relevant passages
  const passages = extractRelevantPassages(content, prophecyKeywords);

  // Generate analysis
  const analysis = {
    keyword_matches: {},
    relevant_passages: passages,
    confidence_score: 0
  };

  // Count keyword occurrences
  const lowerContent = content.toLowerCase();
  for (const keyword of prophecyKeywords) {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'gi');
    const matches = lowerContent.match(regex);
    if (matches) {
      analysis.keyword_matches[keyword] = matches.length;
      analysis.confidence_score += matches.length * 0.5;
    }
  }

  // If AI is available, get deeper analysis
  if (env.AI || env.OPENAI_API_KEY) {
    const prompt = `Analyze the following text for biblical prophecy themes and connections:\n\n${content.substring(0, 2000)}`;

    // Use AI to generate theological analysis
    // (implementation similar to generateAISummary)
  }

  return analysis;
}

/**
 * Extract passages containing relevant keywords
 */
function extractRelevantPassages(content, keywords, contextLength = 200) {
  const passages = [];
  const sentences = content.split(/[.!?]+/);

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();

    for (const keyword of keywords) {
      if (lowerSentence.includes(keyword.toLowerCase())) {
        // Get surrounding context
        const index = sentences.indexOf(sentence);
        const start = Math.max(0, index - 1);
        const end = Math.min(sentences.length, index + 2);
        const passage = sentences.slice(start, end).join('. ') + '.';

        passages.push({
          keyword,
          passage: passage.trim(),
          position: index
        });
        break;
      }
    }
  }

  return passages.slice(0, 10); // Limit to top 10 passages
}
