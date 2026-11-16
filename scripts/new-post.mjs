#!/usr/bin/env node
// Picks one recent, free, exceptional article with Claude Code and saves it as a new post.
// Usage: npm run new-post                 save the post only
//        npm run new-post:push            also commit and push it

import { spawn, execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const POSTS_DIR = path.resolve('src/content/posts');
const TOPICS = ['science', 'culture', 'history'];
const push = process.argv.includes('--push');

const now = new Date();
const today = now.toISOString().slice(0, 10);

// Collect past posts to avoid duplicates.
await mkdir(POSTS_DIR, { recursive: true });
const pastUrls = [];
for (const name of (await readdir(POSTS_DIR, { recursive: true })).filter((f) => f.endsWith('.md'))) {
  const text = await readFile(path.join(POSTS_DIR, name), 'utf8');
  const url = text.match(/^url:\s*"?(.+?)"?\s*$/m)?.[1];
  if (url) pastUrls.push(url);
}

const prompt = `Today is ${today}. Find one exceptional article or essay, freely accessible (no paywall), published in the last two weeks (on or after ${daysAgo(14)}). It can be about science, culture or history — pick whichever is the best article you find.

Prefer long-form, thoughtful writing from reputable publications, magazines, journals or independent writers. Verify the article exists, is free to read, and its publication date, by fetching it.

Do NOT pick any of these already-featured URLs:
${pastUrls.map((u) => `- ${u}`).join('\n') || '- (none yet)'}

Return:
- title: the article's exact title
- author: the author's name (empty string if unknown)
- source: the publication name
- url: the canonical URL
- published: publication date, YYYY-MM-DD
- topic: one of ${TOPICS.join(', ')}
- why: 1–2 sentences on why it is worth reading
- summary: a faithful summary of the article in 3–5 short paragraphs of Markdown, in English, written in your own words (no long quotes).`;

const schema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    author: { type: 'string' },
    source: { type: 'string' },
    url: { type: 'string' },
    published: { type: 'string' },
    topic: { type: 'string', enum: TOPICS },
    why: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['title', 'author', 'source', 'url', 'published', 'topic', 'why', 'summary'],
};

console.log('Finding an article… (this can take a few minutes)');

const result = await runClaude([
  '-p', prompt,
  '--model', 'sonnet',
  '--output-format', 'json',
  '--json-schema', JSON.stringify(schema),
  '--allowedTools', 'WebSearch', 'WebFetch',
]);

const a = result.structured_output;
if (!a) {
  console.error('Claude returned no structured output:\n', result.result ?? result);
  process.exit(1);
}
if (pastUrls.includes(a.url)) {
  console.error(`Duplicate article returned (${a.url}). Run again.`);
  process.exit(1);
}

// Folder (and URL) from the title; add -2, -3… if it already exists.
const base = slugify(a.title);
let slug = base;
for (let i = 2; existsSync(path.join(POSTS_DIR, slug)); i++) slug = `${base}-${i}`;
const dir = path.join(POSTS_DIR, slug);
await mkdir(dir);
const file = path.join(dir, 'index.md');

const cover = await downloadCover(a.url, dir);

const q = (s) => JSON.stringify(s); // JSON strings are valid YAML double-quoted strings
const md = `---
title: ${q(a.title)}
${cover ? `cover: ./${cover}\n` : ''}${a.author ? `author: ${q(a.author)}\n` : ''}source: ${q(a.source)}
url: ${q(a.url)}
published: ${a.published}
date: ${now.toISOString()}
topic: ${a.topic}
why: ${q(a.why)}
---

${a.summary.trim()}
`;

await writeFile(file, md);
console.log(`Saved ${path.relative(process.cwd(), file)}\n  ${a.title} — ${a.source}\n  ${a.url}`);
console.log(cover ? `  cover: ${cover}` : '  no cover image found (topic placeholder will be shown)');

if (push) {
  const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
  git('add', '--', dir);
  git('commit', '-m', `Add post: ${a.title}`, '--', dir);
  git('push');
}

// Downloads the article's preview image (og:image / twitter:image) as cover.<ext>.
// Returns the filename, or null if there is none or it can't be fetched.
async function downloadCover(articleUrl, dir) {
  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };
  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; dailyread/1.0)' };
  try {
    const html = await (await fetch(articleUrl, { headers })).text();
    const meta = (prop) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))?.[1];
    const src = meta('og:image') ?? meta('twitter:image');
    if (!src) return null;
    const res = await fetch(new URL(src.replaceAll('&amp;', '&'), articleUrl), { headers });
    const ext = EXT[res.headers.get('content-type')?.split(';')[0].trim()];
    if (!res.ok || !ext) return null;
    const name = `cover.${ext}`;
    await writeFile(path.join(dir, name), Buffer.from(await res.arrayBuffer()));
    return name;
  } catch {
    return null;
  }
}

function slugify(s) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function daysAgo(n) {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
}

function runClaude(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`claude exited with code ${code}\n${out}`));
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(new Error(`Could not parse claude output:\n${out}`));
      }
    });
  });
}
