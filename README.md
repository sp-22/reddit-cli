# 🤖 Reddit Engage CLI

[![npm version](https://img.shields.io/npm/v/reddit-engage-cli.svg)](https://npmjs.org/package/reddit-engage-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A lightweight, **Agent-Native** CLI for discovering Reddit conversations and drafting high-quality, authentic, non-promotional responses. 

Designed to be driven by humans *or* AI Agents (like Cursor, Windsurf, or Claude) to bridge the gap between prospecting for threads and executing manual, value-first engagement.

## 🌟 Why this exists

AI Agents typically struggle to natively browse Reddit, search for niche conversations, and parse complex thread structures. 

This CLI gives your AI agents the direct ability to:
1. **Surf and Discover:** Run programmatic searches across Reddit or specific subreddits to find highly relevant posts discussing your exact niche.
2. **Extract Clean Data:** Pull down posts, top comments, and subreddit rules in a minimalist, plain-text format specifically designed for LLM ingestion.
3. **Draft Authentic Replies:** Combined with the included Agent Skills, your AI uses the extracted context to draft highly relevant, value-first responses for you to review and manually post.

---

## 🚀 Installation

Install globally via npm to use the CLI from anywhere:

```bash
npm install -g reddit-engage-cli
```

Or run it on the fly using `npx`:

```bash
npx reddit-engage-cli help
```

---

## 💻 CLI Usage

### 1. Discovery
Find relevant threads based on a topic or query.

```bash
# Search across all of Reddit
reddit-engage discover --query "agentic coding workflows"

# Target a specific subreddit
reddit-engage discover --query "nextjs performance" --subreddit "reactjs" --limit 5
```

### 2. Thread Analysis
Fetch the full context of a thread, including the body, top comments, and crucially, the subreddit's rules.

```bash
reddit-engage thread --url "https://reddit.com/r/reactjs/comments/..."
```

### 3. Quick Brief
Get a condensed summary of a thread, perfect for quick agent ingestion without blowing up the context window.

```bash
reddit-engage brief --url "https://reddit.com/r/reactjs/comments/..."
```

---

## 🧠 Using Agent Skills (Vercel Skills.sh)

This project natively supports the **Vercel Agent Skills** ecosystem. By providing your AI with the included `SKILL.md`, it instantly learns the methodology of a community growth expert.

1. Tell your AI (Cursor, Windsurf, generic Claude) to read the prompt inside `skills/reddit-engage/SKILL.md`.
2. The AI will learn the commands it needs to run (`discover`, `thread`) to help you prospect.
3. It will strictly abide by the `reddit-engagement-guidelines.md` when drafting replies, ensuring your account stays safe and your replies provide genuine value.

You can add this skill to your workspace via the Vercel Skills CLI (once published to a repository):
```bash
npx skills add sp-22/reddit-cli
```

---

## 🛠️ Architecture & Privacy

- **Deterministic Output:** All CLI outputs are formatted as clean markdown/plain-text specifically designed for LLM parsing.
- **Local Caching:** API responses are cached in `.cache/reddit-engage` to speed up workflows and reduce API hits.
- **Zero Telemetry:** Everything runs locally. Your queries and drafted responses are never sent anywhere except to the Reddit API and your local LLM context.

## 🤝 Contributing
Issues and Pull Requests are welcome! Let's build the best agentic growth toolkit.

## 📜 License
MIT
