import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import topics from './topics.json';

const topicKeys = topics.map((t) => t.key) as [string, ...string[]];

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    cover: image().optional(),
    author: z.string().optional(),
    source: z.string(),
    url: z.url(),
    published: z.coerce.date(),
    date: z.coerce.date(),
    topic: z.enum(topicKeys),
    why: z.string(),
  }),
});

export const collections = { posts };
