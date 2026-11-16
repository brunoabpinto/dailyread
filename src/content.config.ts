import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

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
    topic: z.enum(['science', 'culture', 'history']),
    why: z.string(),
  }),
});

export const collections = { posts };
