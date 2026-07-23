import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({
    pattern: '*/README.md',
    base: '.generated-content',
    generateId: ({ entry }) => entry.replace(/\/README\.md$/i, ''),
  }),
  schema: z.object({
    title: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});

export const collections = { blog };
