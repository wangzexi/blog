import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { postTitle, postUrl, sortPosts } from '../lib/posts';

export async function GET(context) {
  const posts = sortPosts(await getCollection('blog'));
  return rss({
    title: "Zexi's Blog",
    description: '有价值的未必是我的结论，而是它们带给你思考的扰动。',
    site: context.site,
    items: posts.map((post) => ({
      title: postTitle(post),
      pubDate: new Date(post.data.updated_at),
      link: postUrl(post),
    })),
  });
}
