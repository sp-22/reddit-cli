export interface DiscoverOptions {
  query: string;
  subreddits: string[];
  limit: number;
  timeFilter: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
}

export interface SearchResult {
  id: string;
  title: string;
  subreddit: string;
  author: string | null;
  url: string;
  permalink: string;
  score: number | null;
  numComments: number | null;
  createdUtc: number | null;
  body: string | null;
  matchedTerms: string[];
  whyItMatters: string[];
}

export interface ThreadComment {
  id: string;
  author: string | null;
  body: string;
  score: number | null;
  createdUtc: number | null;
  depth: number;
}

export interface SubredditContext {
  name: string;
  title: string | null;
  description: string | null;
  subscribers: number | null;
  over18: boolean | null;
  rules: string[];
}

export interface ThreadContext {
  id: string;
  title: string;
  subreddit: string;
  author: string | null;
  url: string;
  permalink: string;
  score: number | null;
  numComments: number | null;
  createdUtc: number | null;
  body: string | null;
  comments: ThreadComment[];
  subredditContext: SubredditContext | null;
}
