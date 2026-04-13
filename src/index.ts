#!/usr/bin/env node
import { resolve } from 'node:path';
import { z } from 'zod';
import { LocalCache } from './cache.js';
import { formatBriefOutput, formatDiscoverOutput, formatThreadOutput } from './format.js';
import { discoverThreads, fetchThreadContext } from './reddit.js';

const argvSchema = z.object({
  cacheDir: z.string().default(resolve('.cache/reddit-engage')),
});

function printHelp(): void {
  console.log([
    'Reddit Engage CLI',
    '',
    'Commands:',
    '  discover --query <text> [--subreddit <name>] [--limit <n>] [--time-filter <hour|day|week|month|year|all>]',
    '  thread --url <reddit-url-or-id> [--comments <n>]',
    '  brief --url <reddit-url-or-id>',
    '',
    'Options:',
    '  --cache-dir <dir>   Cache directory, default .cache/reddit-engage',
    '',
    'Output:',
    '  Plain text only. Designed to be read by an agent, not by a JSON parser.',
  ].join('\n'));
}

function parseArgs(argv: string[]): { command: string; positional: string[]; options: Record<string, string | string[] | boolean> } {
  const [command = 'help', ...rest] = argv;
  const positional: string[] = [];
  const options: Record<string, string | string[] | boolean> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]!;
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }

    const next = rest[index + 1];
    switch (token) {
      case '--query':
      case '--url':
      case '--cache-dir':
      case '--limit':
      case '--time-filter':
      case '--comments':
        if (!next || next.startsWith('--')) {
          throw new Error(`Missing value for ${token}`);
        }
        options[token.slice(2)] = next;
        index += 1;
        break;
      case '--subreddit': {
        if (!next || next.startsWith('--')) {
          throw new Error('Missing value for --subreddit');
        }
        const existing = options.subreddit;
        options.subreddit = Array.isArray(existing) ? [...existing, next] : existing ? [String(existing), next] : [next];
        index += 1;
        break;
      }
      default:
        throw new Error(`Unknown option: ${token}`);
    }
  }

  return { command, positional, options };
}

async function main(): Promise<void> {
  const { command, positional, options } = parseArgs(process.argv.slice(2));
  const cacheSettings = argvSchema.parse({
    cacheDir: String(options['cache-dir'] ?? process.env['REDDIT_ENGAGE_CACHE_DIR'] ?? resolve('.cache/reddit-engage')),
  });
  const cache = new LocalCache(cacheSettings.cacheDir);
  await cache.init();

  if (command === 'help' || options.help) {
    printHelp();
    return;
  }

  if (command === 'discover') {
    const query = String(options.query ?? positional[0] ?? '').trim();
    if (!query) {
      throw new Error('discover requires --query <text>.');
    }

    const subreddits = Array.isArray(options.subreddit)
      ? options.subreddit.map(String)
      : options.subreddit
        ? [String(options.subreddit)]
        : [];
    const limit = Number.parseInt(String(options.limit ?? '10'), 10);
    const timeFilter = String(options['time-filter'] ?? 'week');

    const results = await discoverThreads({
      query,
      subreddits,
      limit: Number.isNaN(limit) ? 10 : limit,
      timeFilter: ['hour', 'day', 'week', 'month', 'year', 'all'].includes(timeFilter) ? timeFilter as never : 'week',
    }, cache);

    console.log(formatDiscoverOutput({
      query,
      subreddits,
      limit: Number.isNaN(limit) ? 10 : limit,
      timeFilter: ['hour', 'day', 'week', 'month', 'year', 'all'].includes(timeFilter) ? timeFilter as never : 'week',
    }, results));
    return;
  }

  if (command === 'thread' || command === 'brief') {
    const url = String(options.url ?? positional[0] ?? '').trim();
    if (!url) {
      throw new Error(`${command} requires --url <reddit-url-or-id>.`);
    }
    const commentLimit = Number.parseInt(String(options.comments ?? '12'), 10);
    const context = await fetchThreadContext(url, cache, Number.isNaN(commentLimit) ? 12 : commentLimit);
    console.log(command === 'thread' ? formatThreadOutput(context) : formatBriefOutput(context));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
