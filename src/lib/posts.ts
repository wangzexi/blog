import type { CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

export function postSlug(post: BlogPost): string {
  return post.id.replace(/\/README(?:\.md)?$/i, '');
}

export function postTitle(post: BlogPost): string {
  return post.data.title;
}

export function postUrl(post: BlogPost): string {
  return `/${postSlug(post)}/`;
}

export function postCreatedTimestamp(post: BlogPost): number {
  return Date.parse(post.data.created_at);
}

export function sortPosts(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort((a, b) => postCreatedTimestamp(b) - postCreatedTimestamp(a));
}
