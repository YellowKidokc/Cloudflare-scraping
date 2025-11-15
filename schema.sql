-- Postgres Database Schema for Cloudflare Scraping Agent
-- Biblical Prophecy Database Integration

-- Main table for storing scraped content
CREATE TABLE IF NOT EXISTS prophecy_feeds (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  content TEXT,
  content_md TEXT,
  score FLOAT DEFAULT 0,
  domain TEXT,
  source TEXT DEFAULT 'manual',
  method TEXT,
  scraped_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for common queries
  CONSTRAINT unique_url_scrape UNIQUE (url, scraped_at)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_prophecy_feeds_url ON prophecy_feeds(url);
CREATE INDEX IF NOT EXISTS idx_prophecy_feeds_score ON prophecy_feeds(score DESC);
CREATE INDEX IF NOT EXISTS idx_prophecy_feeds_domain ON prophecy_feeds(domain);
CREATE INDEX IF NOT EXISTS idx_prophecy_feeds_scraped_at ON prophecy_feeds(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_prophecy_feeds_source ON prophecy_feeds(source);

-- Table for RSS feed configurations
CREATE TABLE IF NOT EXISTS rss_feed_config (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  check_interval_hours INTEGER DEFAULT 6,
  last_checked_at TIMESTAMP,
  last_item_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for tracking individual RSS items
CREATE TABLE IF NOT EXISTS rss_items (
  id SERIAL PRIMARY KEY,
  feed_id INTEGER REFERENCES rss_feed_config(id) ON DELETE CASCADE,
  item_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  pub_date TIMESTAMP,
  score FLOAT DEFAULT 0,
  scraped BOOLEAN DEFAULT false,
  scrape_id INTEGER REFERENCES prophecy_feeds(id),
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_feed_item UNIQUE (feed_id, item_url)
);

CREATE INDEX IF NOT EXISTS idx_rss_items_feed_id ON rss_items(feed_id);
CREATE INDEX IF NOT EXISTS idx_rss_items_score ON rss_items(score DESC);
CREATE INDEX IF NOT EXISTS idx_rss_items_scraped ON rss_items(scraped);

-- Table for scraping jobs/queue
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id SERIAL PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  mode TEXT DEFAULT 'manual',
  depth INTEGER DEFAULT 1,
  source TEXT DEFAULT 'manual',
  priority INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error TEXT,
  result_id INTEGER REFERENCES prophecy_feeds(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created_at ON scrape_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_job_id ON scrape_jobs(job_id);

-- Table for keyword matches and analysis
CREATE TABLE IF NOT EXISTS keyword_matches (
  id SERIAL PRIMARY KEY,
  scrape_id INTEGER REFERENCES prophecy_feeds(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  match_count INTEGER DEFAULT 1,
  context TEXT, -- Surrounding text where keyword was found
  weight FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_keyword_matches_scrape_id ON keyword_matches(scrape_id);
CREATE INDEX IF NOT EXISTS idx_keyword_matches_keyword ON keyword_matches(keyword);

-- Table for storing extracted links
CREATE TABLE IF NOT EXISTS extracted_links (
  id SERIAL PRIMARY KEY,
  scrape_id INTEGER REFERENCES prophecy_feeds(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  domain TEXT,
  anchor_text TEXT,
  link_type TEXT, -- internal, external
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_scrape_link UNIQUE (scrape_id, url)
);

CREATE INDEX IF NOT EXISTS idx_extracted_links_scrape_id ON extracted_links(scrape_id);
CREATE INDEX IF NOT EXISTS idx_extracted_links_domain ON extracted_links(domain);

-- View for high-scoring recent items
CREATE OR REPLACE VIEW high_score_items AS
SELECT
  id,
  url,
  title,
  score,
  domain,
  source,
  scraped_at,
  created_at
FROM prophecy_feeds
WHERE score >= 5
ORDER BY score DESC, scraped_at DESC;

-- View for scraping statistics
CREATE OR REPLACE VIEW scraping_stats AS
SELECT
  COUNT(*) as total_scrapes,
  COUNT(DISTINCT domain) as unique_domains,
  AVG(score) as avg_score,
  MAX(score) as max_score,
  COUNT(CASE WHEN score >= 5 THEN 1 END) as high_score_count,
  COUNT(CASE WHEN source = 'rss' THEN 1 END) as rss_scrapes,
  COUNT(CASE WHEN source = 'manual' THEN 1 END) as manual_scrapes,
  MIN(scraped_at) as first_scrape,
  MAX(scraped_at) as last_scrape
FROM prophecy_feeds;

-- View for RSS feed health
CREATE OR REPLACE VIEW rss_feed_health AS
SELECT
  rfc.id,
  rfc.name,
  rfc.url,
  rfc.enabled,
  rfc.last_checked_at,
  rfc.last_item_count,
  rfc.error_count,
  COUNT(ri.id) as total_items,
  COUNT(CASE WHEN ri.score >= 5 THEN 1 END) as high_score_items,
  COUNT(CASE WHEN ri.scraped = true THEN 1 END) as scraped_items,
  MAX(ri.discovered_at) as last_item_discovered
FROM rss_feed_config rfc
LEFT JOIN rss_items ri ON rfc.id = ri.feed_id
GROUP BY rfc.id, rfc.name, rfc.url, rfc.enabled, rfc.last_checked_at, rfc.last_item_count, rfc.error_count;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_prophecy_feeds_updated_at
  BEFORE UPDATE ON prophecy_feeds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rss_feed_config_updated_at
  BEFORE UPDATE ON rss_feed_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate score (example - customize based on your needs)
CREATE OR REPLACE FUNCTION calculate_prophecy_score(
  p_title TEXT,
  p_content TEXT
)
RETURNS FLOAT AS $$
DECLARE
  v_score FLOAT := 0;
  v_keyword TEXT;
  v_keywords TEXT[] := ARRAY[
    'prophecy', 'biblical', 'revelation', 'eschatology',
    'end times', 'apocalypse', 'messiah', 'tribulation',
    'rapture', 'millennium', 'daniel', 'ezekiel',
    'jerusalem', 'israel', 'temple', 'antichrist', 'armageddon'
  ];
BEGIN
  FOREACH v_keyword IN ARRAY v_keywords
  LOOP
    -- Count occurrences in title (weight 2x)
    v_score := v_score + (
      SELECT COUNT(*) * 2.0
      FROM regexp_matches(LOWER(p_title), '\m' || v_keyword || '\M', 'g')
    );

    -- Count occurrences in content (weight 1x)
    v_score := v_score + (
      SELECT COUNT(*) * 1.0
      FROM regexp_matches(LOWER(p_content), '\m' || v_keyword || '\M', 'g')
    );
  END LOOP;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- Sample data insertion (for testing)
-- INSERT INTO rss_feed_config (url, name, enabled, check_interval_hours)
-- VALUES
--   ('https://example.com/prophecy-feed.xml', 'Prophecy News', true, 6),
--   ('https://example.com/biblical-news.xml', 'Biblical Updates', true, 12);

-- Query examples:
--
-- Get all high-scoring items from last 7 days:
-- SELECT * FROM high_score_items WHERE scraped_at > NOW() - INTERVAL '7 days';
--
-- Get scraping statistics:
-- SELECT * FROM scraping_stats;
--
-- Get RSS feed health:
-- SELECT * FROM rss_feed_health;
--
-- Get items by domain:
-- SELECT domain, COUNT(*) as count, AVG(score) as avg_score
-- FROM prophecy_feeds
-- GROUP BY domain
-- ORDER BY count DESC;
