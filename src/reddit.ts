import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DiscoverOptions, SearchResult, SubredditContext, ThreadComment, ThreadContext } from './types.js';
import { LocalCache } from './cache.js';

const listingSchema = z.object({
  data: z.object({
    children: z.array(z.object({
      kind: z.string(),
      data: z.record(z.any()),
    })),
  }),
});

const subredditAboutSchema = z.object({
  data: z.object({
    display_name: z.string().optional(),
    title: z.string().nullable().optional(),
    public_description: z.string().nullable().optional(),
    subscribers: z.number().nullable().optional(),
    over18: z.boolean().nullable().optional(),
  }),
});

const subredditRulesSchema = z.object({
  rules: z.array(z.object({
    short_name: z.string().optional(),
    description: z.string().nullable().optional(),
  })).default([]),
});

function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeSubreddit(value: string): string {
  return value.trim().replace(/^r\//i, '').toLowerCase();
}

function safeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function shortHash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 12);
}

function toRedditUrl(permalink: string): string {
  return permalink.startsWith('http') ? permalink : `https://www.reddit.com${permalink}`;
}

function extractMatchedTerms(text: string, query: string): string[] {
  const haystack = text.toLowerCase();
  const terms = normalizeQuery(query)
    .split(' ')
    .map((term) => term.toLowerCase().replace(/[^a-z0-9]+/g, ''))
    .filter(Boolean);
  return [...new Set(terms.filter((term) => haystack.includes(term)))];
}

function scoreResult(post: SearchResult, query: string, targetSubreddits: string[]): number {
  const ageHours = post.createdUtc ? Math.max(0, (Date.now() / 1000 - post.createdUtc) / 3600) : 9999;
  const recencyBoost = ageHours < 24 ? 40 : ageHours < 72 ? 20 : ageHours < 168 ? 8 : 0;
  const targetBoost = targetSubreddits.includes(post.subreddit.toLowerCase()) ? 25 : 0;
  const bodyText = `${post.title} ${post.body ?? ''}`;
  const matchBoost = extractMatchedTerms(bodyText, query).length * 12;
  const engagementBoost = (post.score ?? 0) > 0 ? Math.min(20, Math.log10((post.score ?? 1) + 1) * 8) : 0;
  const commentsBoost = (post.numComments ?? 0) > 0 ? Math.min(15, Math.log10((post.numComments ?? 1) + 1) * 6) : 0;
  return recencyBoost + targetBoost + matchBoost + engagementBoost + commentsBoost;
}

function whyMatters(post: SearchResult, query: string, targetSubreddits: string[]): string[] {
  const reasons: string[] = [];
  const matchedTerms = extractMatchedTerms(`${post.title} ${post.body ?? ''}`, query);
  if (matchedTerms.length > 0) {
    reasons.push(`matches terms: ${matchedTerms.join(', ')}`);
  }
  if (targetSubreddits.includes(post.subreddit.toLowerCase())) {
    reasons.push(`in target subreddit r/${post.subreddit}`);
  }
  if ((post.numComments ?? 0) >= 5) {
    reasons.push('already has discussion momentum');
  }
  if ((post.score ?? 0) >= 10) {
    reasons.push('already showing engagement');
  }
  return reasons;
}

function parseSearchPost(data: Record<string, any>): SearchResult {
  const permalink = safeText(data['permalink']) ?? '';
  return {
    id: safeText(data['id']) ?? shortHash(JSON.stringify(data)),
    title: safeText(data['title']) ?? '(untitled)',
    subreddit: safeText(data['subreddit']) ?? 'unknown',
    author: safeText(data['author']),
    url: safeText(data['url']) ?? toRedditUrl(permalink),
    permalink,
    score: typeof data['score'] === 'number' ? data['score'] : null,
    numComments: typeof data['num_comments'] === 'number' ? data['num_comments'] : null,
    createdUtc: typeof data['created_utc'] === 'number' ? data['created_utc'] : null,
    body: safeText(data['selftext']),
    matchedTerms: [],
    whyItMatters: [],
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'reddit-engage-cli/0.1 (agent-assisted Reddit discovery)',
      'accept': 'application/json,text/plain,*/*',
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

async function fetchSubredditContext(subreddit: string): Promise<SubredditContext | null> {
  try {
    const [aboutRaw, rulesRaw] = await Promise.all([
      fetchJson(`https://www.reddit.com/r/${subreddit}/about.json`),
      fetchJson(`https://www.reddit.com/r/${subreddit}/about/rules.json`),
    ]);

    const about = subredditAboutSchema.parse(aboutRaw);
    const rules = subredditRulesSchema.parse(rulesRaw);

    return {
      name: about.data.display_name ?? subreddit,
      title: about.data.title ?? null,
      description: about.data.public_description ?? null,
      subscribers: about.data.subscribers ?? null,
      over18: about.data.over18 ?? null,
      rules: rules.rules
        .map((rule) => [rule.short_name, rule.description].filter(Boolean).join(': '))
        .filter((rule) => rule.length > 0),
    };
  } catch {
    return null;
  }
}

function extractComments(raw: unknown, limit: number): ThreadComment[] {
  const parsed = listingSchema.parse(raw);
  const comments: ThreadComment[] = [];

  function visit(children: Array<{ kind: string; data: Record<string, any> }>, depth: number): void {
    for (const child of children) {
      if (child.kind !== 't1') {
        continue;
      }
      comments.push({
        id: safeText(child.data['id']) ?? shortHash(JSON.stringify(child.data)),
        author: safeText(child.data['author']),
        body: safeText(child.data['body']) ?? '',
        score: typeof child.data['score'] === 'number' ? child.data['score'] : null,
        createdUtc: typeof child.data['created_utc'] === 'number' ? child.data['created_utc'] : null,
        depth,
      });
      const replies = child.data['replies'];
      if (replies && typeof replies === 'object' && 'data' in replies) {
        const replyListing = listingSchema.safeParse(replies);
        if (replyListing.success) {
          visit(replyListing.data.data.children, depth + 1);
        }
      }
      if (comments.length >= limit) {
        return;
      }
    }
  }

  visit(parsed.data.children, 0);
  return comments.slice(0, limit);
}

export async function discoverThreads(options: DiscoverOptions, cache: LocalCache): Promise<SearchResult[]> {
  const query = normalizeQuery(options.query);
  const targetSubreddits = options.subreddits.map(normalizeSubreddit);
  const cacheKey = shortHash(JSON.stringify(options));
  const cached = await cache.readText(`discover/${cacheKey}.json`);
  if (cached) {
    try {
      return JSON.parse(cached) as SearchResult[];
    } catch {
      // Fall through and refresh the cache if the file is stale or manually edited.
    }
  }

  const urls = targetSubreddits.length > 0
    ? targetSubreddits.map((subreddit) => `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&t=${options.timeFilter}&limit=${options.limit}`)
    : [`https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&t=${options.timeFilter}&limit=${options.limit}`];

  const rawResults = await Promise.all(urls.map(async (url) => fetchJson(url)));
  const posts = rawResults.flatMap((raw) => {
    const parsed = listingSchema.parse(raw);
    return parsed.data.children
      .filter((child) => child.kind === 't3')
      .map((child) => parseSearchPost(child.data));
  });

  const deduped = new Map<string, SearchResult>();
  for (const post of posts) {
    const matchedTerms = extractMatchedTerms(`${post.title} ${post.body ?? ''}`, query);
    const enriched: SearchResult = {
      ...post,
      matchedTerms,
      whyItMatters: whyMatters(post, query, targetSubreddits),
    };
    const current = deduped.get(enriched.id);
    if (!current || scoreResult(enriched, query, targetSubreddits) > scoreResult(current, query, targetSubreddits)) {
      deduped.set(enriched.id, enriched);
    }
  }

  const results = [...deduped.values()]
    .sort((left, right) => scoreResult(right, query, targetSubreddits) - scoreResult(left, query, targetSubreddits))
    .slice(0, options.limit);

  await cache.writeText(`discover/${cacheKey}.json`, JSON.stringify(results, null, 2));
  return results;
}

export async function fetchThreadContext(urlOrId: string, cache: LocalCache, commentLimit = 12): Promise<ThreadContext> {
  const normalized = urlOrId.trim();
  const cacheKey = shortHash(normalized);
  const cached = await cache.readText(`thread/${cacheKey}.json`);
  if (cached) {
    return JSON.parse(cached) as ThreadContext;
  }

  const parsedUrl = normalized.startsWith('http') ? new URL(normalized) : null;
  const threadId = normalized.match(/(?:comments\/)([a-z0-9]+)/i)?.[1]
    ?? parsedUrl?.pathname.match(/(?:comments\/)([a-z0-9]+)/i)?.[1]
    ?? normalized.match(/^[a-z0-9]+$/i)?.[0]
    ?? null;

  if (!threadId) {
    throw new Error(`Could not extract a Reddit thread id from: ${urlOrId}`);
  }

  const threadJson = await fetchJson(`https://www.reddit.com/comments/${threadId}.json?sort=top&limit=${commentLimit}`);
  const listings = z.array(listingSchema).parse(threadJson);
  const postListing = listings[0];
  const commentListing = listings[1];
  const postData = postListing.data.children.find((child) => child.kind === 't3')?.data ?? {};
  const subreddit = safeText(postData['subreddit']) ?? 'unknown';
  const subredditContext = await fetchSubredditContext(subreddit);

  const context: ThreadContext = {
    id: safeText(postData['id']) ?? threadId,
    title: safeText(postData['title']) ?? '(untitled)',
    subreddit,
    author: safeText(postData['author']),
    url: safeText(postData['url']) ?? `https://www.reddit.com/comments/${threadId}`,
    permalink: safeText(postData['permalink']) ?? `/comments/${threadId}`,
    score: typeof postData['score'] === 'number' ? postData['score'] : null,
    numComments: typeof postData['num_comments'] === 'number' ? postData['num_comments'] : null,
    createdUtc: typeof postData['created_utc'] === 'number' ? postData['created_utc'] : null,
    body: safeText(postData['selftext']),
    comments: commentListing ? extractComments(commentListing, commentLimit) : [],
    subredditContext,
  };

  await cache.writeText(`thread/${cacheKey}.json`, JSON.stringify(context, null, 2));
  return context;
}

export function formatAge(createdUtc: number | null): string {
  if (!createdUtc) {
    return 'unknown age';
  }
  const diffSeconds = Math.max(0, Math.floor(Date.now() / 1000) - createdUtc);
  if (diffSeconds < 60) {
    return `${diffSeconds} second${diffSeconds === 1 ? '' : 's'} ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}
