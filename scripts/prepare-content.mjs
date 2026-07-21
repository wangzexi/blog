import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const generatedContent = join(root, '.generated-content');
const publicAssets = join(root, 'public', 'content-assets');
const excluded = new Set(['assets', 'node_modules', 'public', 'scripts', 'src', 'dist']);

await rm(generatedContent, { recursive: true, force: true });
await rm(publicAssets, { recursive: true, force: true });
await mkdir(generatedContent, { recursive: true });
await mkdir(publicAssets, { recursive: true });

const entries = await readdir(root, { withFileTypes: true });
let count = 0;

for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name.startsWith('_') || excluded.has(entry.name)) {
    continue;
  }

  const sourceReadme = join(root, entry.name, 'README.md');
  let markdown;
  try {
    markdown = await readFile(sourceReadme, 'utf8');
  } catch {
    continue;
  }

  const assetPrefix = `/content-assets/${entry.name}/`;
  const publishable = markdown
    .replace(/\]\(assets\//g, `](${assetPrefix}`)
    .replace(/^```TypeScript$/gm, '```typescript');
  const targetDir = join(generatedContent, entry.name);
  await mkdir(targetDir, { recursive: true });
  await writeFile(join(targetDir, 'README.md'), publishable, 'utf8');

  const sourceAssets = join(root, entry.name, 'assets');
  try {
    await cp(sourceAssets, join(publicAssets, entry.name), { recursive: true });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  count += 1;
}

console.log(`Prepared ${count} public articles without changing their source folders.`);
