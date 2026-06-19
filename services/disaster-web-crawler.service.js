/**
 * Allowlisted disaster web crawler — RSS/Atom feeds and shallow HTML indexes.
 * Does NOT scrape arbitrary newspaper paywalls; use public RSS when publishers provide it.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DOMParser } from '@xmldom/xmldom';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEEDS_PATH = path.join(__dirname, '../data/disaster-crawl-feeds.json');

const USER_AGENT = 'DevConnectLabs-DisasterCrawler/1.0 (+https://github.com/devconnect-labs)';
const FETCH_TIMEOUT_MS = 25_000;
const MIN_REQUEST_GAP_MS = 400;

const DISASTER_KEYWORDS =
  /\b(hurricane|tropical storm|flood|flash flood|wildfire|fire weather|earthquake|tornado|severe thunder|storm surge|evacuation|disaster|FEMA|heat warning|heat advisory|red flag|landslide|tsunami|cyclone|hail|blizzard|drought)\b/i;

const ALLOWED_HOST_SUFFIXES = [
  '.gov',
  'weather.gov',
  'usgs.gov',
  'nasa.gov',
  'noaa.gov',
  'fema.gov',
  'redcross.org',
  'ready.gov',
];

let lastRequestAt = 0;
let lastGdeltRequestAt = 0;

const GDELT_DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAllowedUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix.replace(/^\./, '') || host.endsWith(suffix));
  } catch {
    return false;
  }
}

function textContent(node, tagName) {
  if (!node) return '';
  const els = node.getElementsByTagName(tagName);
  if (!els?.length) return '';
  return (els[0].textContent || '').replace(/\s+/g, ' ').trim();
}

function linkHref(node) {
  if (!node) return null;
  const links = node.getElementsByTagName('link');
  for (let i = 0; i < links.length; i++) {
    const rel = (links[i].getAttribute('rel') || '').toLowerCase();
    const href = links[i].getAttribute('href');
    if (href && (!rel || rel === 'alternate' || rel === 'related')) return href;
  }
  const anchors = node.getElementsByTagName('a');
  if (anchors?.length) return anchors[0].getAttribute('href');
  return null;
}

function parseFeedDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseFeedXml(xml, feedMeta) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const parseError = doc.getElementsByTagName('parsererror');
  if (parseError?.length) {
    throw new Error(`XML parse error for ${feedMeta.id}`);
  }

  const entryNodes = [];
  for (const tag of ['entry', 'item']) {
    const nodes = doc.getElementsByTagName(tag);
    for (let i = 0; i < nodes.length; i++) entryNodes.push(nodes[i]);
  }

  const items = [];
  for (const node of entryNodes) {
    const title = textContent(node, 'title');
    const summary = textContent(node, 'summary') || textContent(node, 'description') || textContent(node, 'content');
    const url = linkHref(node);
    const publishedAt = parseFeedDate(textContent(node, 'updated') || textContent(node, 'published') || textContent(node, 'pubDate'));
    if (!title && !summary) continue;
    items.push({
      feedId: feedMeta.id,
      source: feedMeta.source,
      publisher: feedMeta.publisher,
      trustTier: feedMeta.trustTier || 'official',
      title: title || summary.slice(0, 120),
      summary: summary ? summary.slice(0, 500) : null,
      url: url || null,
      publishedAt,
      crawledAt: new Date().toISOString(),
      contentType: 'feed',
    });
  }
  return items;
}

function matchesKeywords(item) {
  const blob = `${item.title || ''} ${item.summary || ''}`;
  return DISASTER_KEYWORDS.test(blob);
}

function withinMaxAge(publishedAt, maxAgeHours) {
  if (!publishedAt || !Number.isFinite(maxAgeHours)) return true;
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  return ageMs <= maxAgeHours * 3600 * 1000;
}

function dedupeItems(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = (item.url || `${item.feedId}|${item.title}`).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function throttleFetch(url, headers = {}) {
  const gap = Date.now() - lastRequestAt;
  if (gap < MIN_REQUEST_GAP_MS) await sleep(MIN_REQUEST_GAP_MS - gap);
  lastRequestAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml, text/html;q=0.8',
        ...headers,
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return { text, contentType, finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

export function loadCrawlFeedConfig() {
  const raw = fs.readFileSync(FEEDS_PATH, 'utf8');
  const json = JSON.parse(raw);
  const feeds = [...(json.feeds || [])];
  for (const ex of json.newspaperRssExamples || []) {
    if (ex.enabled) feeds.push(ex);
  }
  for (const regional of json.femaRegionalRss || []) {
    if (regional.enabled) feeds.push(regional);
  }
  return { ...json, feeds };
}

function parseGdeltSeenDate(seendate) {
  const raw = String(seendate || '').trim();
  if (raw.length < 14) return null;
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeGdeltArticle(article, feedMeta) {
  const title = String(article?.title || '').trim();
  if (!title) return null;
  return {
    feedId: feedMeta.id,
    source: 'gdelt',
    publisher: article.domain || article.source || 'GDELT',
    trustTier: 'news',
    title,
    summary: article.language ? `Language: ${article.language}` : null,
    url: article.url || article.socialimage || null,
    publishedAt: parseGdeltSeenDate(article.seendate),
    crawledAt: new Date().toISOString(),
    contentType: 'gdelt_api',
    country: article.sourcecountry || null,
  };
}

async function crawlGdelt(feedMeta, options = {}) {
  const startedAt = Date.now();
  const maxAgeHours = Number.isFinite(options.maxAgeHours) ? options.maxAgeHours : 72;
  const maxRecords = Number.isFinite(feedMeta.maxRecords) ? feedMeta.maxRecords : 20;
  const minGap = Number.isFinite(feedMeta.minRequestGapMs) ? feedMeta.minRequestGapMs : 5500;

  const gap = Date.now() - lastGdeltRequestAt;
  if (gap < minGap) await sleep(minGap - gap);

  const params = new URLSearchParams({
    query: feedMeta.query,
    mode: 'ArtList',
    format: 'json',
    maxrecords: String(maxRecords),
    timespan: feedMeta.timespan || '24h',
  });

  try {
    lastGdeltRequestAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let data;
    try {
      const res = await fetch(`${GDELT_DOC_URL}?${params}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text.startsWith('Please limit') ? 'GDELT rate limit — retry in 5+ seconds' : `HTTP ${res.status}`);
      }
      data = JSON.parse(text);
    } finally {
      clearTimeout(timer);
    }

    let items = (data?.articles || []).map((a) => normalizeGdeltArticle(a, feedMeta)).filter(Boolean);
    items = items.filter((item) => withinMaxAge(item.publishedAt, maxAgeHours));
    items.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

    return {
      feedId: feedMeta.id,
      publisher: 'GDELT DOC 2.0',
      ok: true,
      count: items.length,
      items,
      elapsedMs: Date.now() - startedAt,
      error: null,
    };
  } catch (err) {
    return {
      feedId: feedMeta.id,
      publisher: 'GDELT DOC 2.0',
      ok: false,
      count: 0,
      items: [],
      elapsedMs: Date.now() - startedAt,
      error: err.message || String(err),
    };
  }
}

async function crawlFeed(feedMeta, options = {}) {
  const startedAt = Date.now();
  const maxAgeHours = Number.isFinite(options.maxAgeHours) ? options.maxAgeHours : 72;
  const maxItems = Number.isFinite(feedMeta.maxItems) ? feedMeta.maxItems : 20;

  if (!isAllowedUrl(feedMeta.url) && feedMeta.trustTier !== 'news') {
    return {
      feedId: feedMeta.id,
      ok: false,
      count: 0,
      items: [],
      elapsedMs: Date.now() - startedAt,
      error: `Host not allowlisted: ${feedMeta.url}`,
    };
  }

  try {
    const { text } = await throttleFetch(feedMeta.url);
    let items = parseFeedXml(text, feedMeta);
    if (feedMeta.keywordFilter !== false) {
      items = items.filter(matchesKeywords);
    }
    items = items.filter((item) => withinMaxAge(item.publishedAt, maxAgeHours));
    items.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    items = items.slice(0, maxItems);
    return {
      feedId: feedMeta.id,
      publisher: feedMeta.publisher,
      ok: true,
      count: items.length,
      items,
      elapsedMs: Date.now() - startedAt,
      error: null,
    };
  } catch (err) {
    return {
      feedId: feedMeta.id,
      publisher: feedMeta.publisher,
      ok: false,
      count: 0,
      items: [],
      elapsedMs: Date.now() - startedAt,
      error: err.message || String(err),
    };
  }
}

async function crawlHtmlIndex(indexMeta, options = {}) {
  const startedAt = Date.now();
  const maxItems = Number.isFinite(indexMeta.maxItems) ? indexMeta.maxItems : 12;
  const maxAgeHours = Number.isFinite(options.maxAgeHours) ? options.maxAgeHours : 72;

  if (!isAllowedUrl(indexMeta.url)) {
    return {
      feedId: indexMeta.id,
      ok: false,
      count: 0,
      items: [],
      elapsedMs: Date.now() - startedAt,
      error: `Host not allowlisted: ${indexMeta.url}`,
    };
  }

  try {
    const { text, finalUrl } = await throttleFetch(indexMeta.url, { Accept: 'text/html' });
    const $ = cheerio.load(text);
    const selector = indexMeta.linkSelector || 'article a[href], .views-row a[href], a[href]';
    const items = [];
    const base = new URL(finalUrl);

    $(selector).each((_, el) => {
      if (items.length >= maxItems * 3) return false;
      const href = $(el).attr('href');
      const title = $(el).text().replace(/\s+/g, ' ').trim();
      if (!href || !title || title.length < 12) return;
      let abs;
      try {
        abs = new URL(href, base).toString();
      } catch {
        return;
      }
      if (!isAllowedUrl(abs)) return;
      if (indexMeta.keywordFilter !== false && !matchesKeywords({ title })) return;
      items.push({
        feedId: indexMeta.id,
        source: indexMeta.source || 'web',
        publisher: indexMeta.publisher,
        trustTier: indexMeta.trustTier || 'official',
        title,
        summary: null,
        url: abs,
        publishedAt: null,
        crawledAt: new Date().toISOString(),
        contentType: 'html_index',
      });
    });

    const deduped = dedupeItems(items).slice(0, maxItems);
    return {
      feedId: indexMeta.id,
      publisher: indexMeta.publisher,
      ok: true,
      count: deduped.length,
      items: deduped.filter((item) => withinMaxAge(item.publishedAt, maxAgeHours)),
      elapsedMs: Date.now() - startedAt,
      error: null,
    };
  } catch (err) {
    return {
      feedId: indexMeta.id,
      publisher: indexMeta.publisher,
      ok: false,
      count: 0,
      items: [],
      elapsedMs: Date.now() - startedAt,
      error: err.message || String(err),
    };
  }
}

/**
 * Crawl allowlisted RSS/Atom feeds, GDELT news API, and optional shallow HTML indexes.
 * @param {{ maxAgeHours?: number, feedIds?: string[], includeGdelt?: boolean }} [options]
 */
export async function crawlDisasterWeb(options = {}) {
  const config = loadCrawlFeedConfig();
  const feedIds = Array.isArray(options.feedIds) ? new Set(options.feedIds) : null;
  const feeds = config.feeds.filter((f) => !feedIds || feedIds.has(f.id));
  const indexes = (config.htmlIndexes || []).filter((f) => f.enabled !== false && (!feedIds || feedIds.has(f.id)));

  const feedResults = await Promise.all(feeds.map((f) => crawlFeed(f, options)));
  const indexResults = [];
  for (const idx of indexes) {
    indexResults.push(await crawlHtmlIndex(idx, options));
  }

  const gdeltResults = [];
  const includeGdelt = options.includeGdelt !== false && config.gdelt?.enabled;
  if (includeGdelt && (!feedIds || feedIds.has(config.gdelt.id))) {
    gdeltResults.push(await crawlGdelt({ ...config.gdelt, id: config.gdelt.id || 'gdelt-doc-us-disasters' }, options));
  }

  const allResults = [...feedResults, ...indexResults, ...gdeltResults];
  const allItems = dedupeItems(allResults.flatMap((r) => r.items));
  allItems.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

  const generatedAt = new Date().toISOString();
  return {
    generatedAt,
    policy: {
      allowlistedHosts: ALLOWED_HOST_SUFFIXES,
      newspaperNote: 'Add newspaper URLs only as public RSS entries in data/disaster-crawl-feeds.json — no paywall HTML scraping.',
      gdeltNote: 'GDELT DOC API: max one request per 5 seconds; US disaster keyword query with sourcecountry:US.',
      femaRegionalNote: 'FEMA regional RSS entries ship disabled until feeds stop returning 403/503.',
    },
    summary: {
      totalItems: allItems.length,
      bySource: allItems.reduce((acc, item) => {
        acc[item.source] = (acc[item.source] || 0) + 1;
        return acc;
      }, {}),
      feedStatus: allResults.map(({ feedId, publisher, ok, count, elapsedMs, error }) => ({
        feedId,
        publisher,
        ok,
        count,
        elapsedMs,
        error,
      })),
      failures: allResults.filter((r) => !r.ok).map((r) => ({ feedId: r.feedId, error: r.error })),
    },
    items: allItems,
    feeds: Object.fromEntries(allResults.map((r) => [r.feedId, r.items])),
  };
}

export function topCrawlHeadlines(crawlData, limit = 5) {
  return (crawlData?.items || []).slice(0, limit);
}

export default {
  loadCrawlFeedConfig,
  crawlDisasterWeb,
  topCrawlHeadlines,
};
