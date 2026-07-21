import type { CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

export function postSlug(post: BlogPost): string {
  return post.id.replace(/\/README(?:\.md)?$/i, '');
}

export function postTitle(post: BlogPost): string {
  const match = post.body?.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || postSlug(post);
}

export function postUrl(post: BlogPost): string {
  return `/${postSlug(post)}/`;
}

export function postTimestamp(post: BlogPost): number {
  return Date.parse(post.data.updated_at);
}

export function sortPosts(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort((a, b) => postTimestamp(b) - postTimestamp(a));
}
