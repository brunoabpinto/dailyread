# Daily Read

One exceptional, free-to-read article every day — science, culture or history — with a summary, why it's worth reading, and a link to the original.

Built with [Astro](https://astro.build), deployed on Netlify. Posts are picked and summarised by [Claude Code](https://claude.com/claude-code).

## Requirements

- Node 24 (`nvm use` — see `.nvmrc`)
- Claude Code CLI (`claude`), signed in — used by `npm run new-post`

## Commands

| Command            | Action                                          |
| :----------------- | :---------------------------------------------- |
| `npm install`      | Install dependencies                            |
| `npm run dev`      | Start the dev server at `localhost:4321`        |
| `npm run new-post` | Find a new article and save it as a post        |
| `npm run build`    | Build the site to `./dist/`                     |
| `npm run preview`  | Preview the build locally                       |

## Adding a post

```sh
nvm use
npm run new-post
```

The script (`scripts/new-post.mjs`):

1. Asks Claude to find a free article published in the last two weeks, skipping any already featured.
2. Gets back the title, author, source, URL, publication date, topic, why it's worth reading, and a summary.
3. Downloads the article's preview image (`og:image`) as the cover, if there is one.
4. Saves everything to `src/content/posts/<title-slug>/`.

Run it as many times as you like — each run adds one post. It takes a few minutes.

Commit and push the new post folder; Netlify rebuilds the site.

## Post format

Each post is a folder named after its title, which is also its URL (`/posts/<title-slug>/`):

```text
src/content/posts/<title-slug>/
├── index.md    # frontmatter + summary
└── cover.jpg   # optional; topic-coloured placeholder if missing
```

```yaml
---
title: "Article title"
cover: ./cover.jpg          # optional
author: "Author name"       # optional
source: "Publication"
url: "https://…"
published: 2026-11-06       # article's publication date
date: 2026-11-16T09:20:00Z  # when the post was added (used for ordering)
topic: science              # science | culture | history
why: "Why it's worth reading."
---

Summary in Markdown…
```

The schema is defined in `src/content.config.ts`.

## Project structure

```text
/
├── public/                  # favicon
├── scripts/new-post.mjs     # adds a post using Claude Code
├── src/
│   ├── content/posts/       # one folder per post
│   ├── content.config.ts    # post schema
│   ├── layouts/Base.astro   # page shell, styles, light/dark toggle
│   └── pages/
│       ├── index.astro      # list of all posts, newest first
│       └── posts/[id].astro # single post page
├── netlify.toml             # Netlify build settings
└── .nvmrc                   # Node version (also used by Netlify)
```
