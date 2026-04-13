import type { DiscoverOptions, SearchResult, ThreadContext } from './types.js';
import { formatAge } from './reddit.js';

function indent(text: string, spaces = 2): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map((line) => `${pad}${line}`).join('\n');
}

function wrapBody(body: string | null): string {
  if (!body || !body.trim()) {
    return '(no body text)';
  }
  return body.trim();
}

export function formatDiscoverOutput(options: DiscoverOptions, results: SearchResult[]): string {
  const lines: string[] = [];
  lines.push('REDDIT DISCOVERY');
  lines.push(`Query: ${options.query}`);
  lines.push(`Subreddits: ${options.subreddits.length > 0 ? options.subreddits.map((subreddit) => `r/${subreddit}`).join(', ') : 'all'}`);
  lines.push(`Limit: ${options.limit}`);
  lines.push(`Time filter: ${options.timeFilter}`);
  lines.push('');

  if (results.length === 0) {
    lines.push('No obvious opportunities found.');
    return lines.join('\n');
  }

  lines.push('CANDIDATES');
  results.forEach((result, index) => {
    lines.push(`${index + 1}. ${result.title}`);
    lines.push(`   r/${result.subreddit} | ${result.author ? `u/${result.author}` : 'author unknown'} | ${formatAge(result.createdUtc)} | score ${result.score ?? 'n/a'} | comments ${result.numComments ?? 'n/a'}`);
    lines.push(`   URL: ${result.url}`);
    if (result.body) {
      lines.push(`   Snippet: ${wrapBody(result.body).slice(0, 280)}`);
    }
    if (result.matchedTerms.length > 0) {
      lines.push(`   Matched terms: ${result.matchedTerms.join(', ')}`);
    }
    if (result.whyItMatters.length > 0) {
      lines.push(`   Why this matters: ${result.whyItMatters.join('; ')}`);
    }
    lines.push('');
  });

  return lines.join('\n').trimEnd();
}

export function formatThreadOutput(context: ThreadContext): string {
  const lines: string[] = [];
  lines.push('REDDIT THREAD');
  lines.push(`Title: ${context.title}`);
  lines.push(`Subreddit: r/${context.subreddit}`);
  lines.push(`Author: ${context.author ? `u/${context.author}` : 'unknown'}`);
  lines.push(`Age: ${formatAge(context.createdUtc)}`);
  lines.push(`Score: ${context.score ?? 'n/a'}`);
  lines.push(`Comments: ${context.numComments ?? 'n/a'}`);
  lines.push(`URL: ${context.url}`);
  lines.push('');
  lines.push('POST');
  lines.push(indent(wrapBody(context.body)));
  lines.push('');

  if (context.subredditContext) {
    lines.push('SUBREDDIT CONTEXT');
    if (context.subredditContext.title) {
      lines.push(`Title: ${context.subredditContext.title}`);
    }
    if (context.subredditContext.description) {
      lines.push(`Description: ${context.subredditContext.description}`);
    }
    if (context.subredditContext.subscribers != null) {
      lines.push(`Subscribers: ${context.subredditContext.subscribers}`);
    }
    if (context.subredditContext.over18 != null) {
      lines.push(`NSFW: ${context.subredditContext.over18 ? 'yes' : 'no'}`);
    }
    if (context.subredditContext.rules.length > 0) {
      lines.push('Rules:');
      context.subredditContext.rules.forEach((rule) => lines.push(`  - ${rule}`));
    }
    lines.push('');
  }

  lines.push('TOP COMMENTS');
  if (context.comments.length === 0) {
    lines.push('  No comments captured.');
  } else {
    context.comments.forEach((comment, index) => {
      lines.push(`${index + 1}. ${comment.author ? `u/${comment.author}` : 'unknown'} | score ${comment.score ?? 'n/a'} | ${formatAge(comment.createdUtc)}`);
      lines.push(indent(wrapBody(comment.body), 4));
      lines.push('');
    });
  }

  return lines.join('\n').trimEnd();
}

export function formatBriefOutput(context: ThreadContext): string {
  const lines: string[] = [];
  lines.push('ENGAGEMENT BRIEF');
  lines.push(`Thread: ${context.title}`);
  lines.push(`Subreddit: r/${context.subreddit}`);
  lines.push(`URL: ${context.url}`);
  lines.push('');
  lines.push('AGENT TAKEAWAY');
  lines.push('- Read the post, top comments, and subreddit rules before drafting anything.');
  lines.push('- Lead with usefulness; mention the product only if it fits naturally.');
  lines.push('- If the thread is mainly promotional, treat it as a low-priority or skip candidate.');
  lines.push('');
  lines.push('WHAT TO NOTICE');
  const notice: string[] = [];
  if (context.body) {
    notice.push('The original post contains enough detail to answer directly.');
  } else {
    notice.push('The post is short, so a concise helpful reply may work well.');
  }
  if (context.comments.length > 0) {
    notice.push('There is already discussion, so read the top replies before commenting.');
  }
  if (context.subredditContext?.rules.length) {
    notice.push('Check the subreddit rules before mentioning a product.');
  }
  notice.forEach((line) => lines.push(`- ${line}`));
  lines.push('');
  lines.push('CONTEXT');
  lines.push(indent(wrapBody(context.body), 2));
  lines.push('');
  lines.push('COMMENT SAMPLE INPUT');
  lines.push('- If replying, lead with a direct answer or useful tip.');
  lines.push('- Mention the product only if it truly fits the question.');
  lines.push('- Avoid sounding like a pitch.');
  return lines.join('\n').trimEnd();
}
