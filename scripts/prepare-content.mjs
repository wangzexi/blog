import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const generatedContent = join(root, '.generated-content');
const publicAssets = join(root, 'public', 'content-assets');
const excluded = new Set(['assets', 'node_modules', 'public', 'scripts', 'src', 'dist']);

function renderHighlights(markdown) {
  let fence = null;

  return markdown.split('\n').map((line) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === marker) fence = null;
      else if (fence === null) fence = marker;
      return line;
    }

    if (fence !== null) return line;

    return line.replace(/(`+[^`]*`+)|==(.+?)==/g, (_match, code, highlighted) =>
      code ?? `<mark>${highlighted}</mark>`
    );
  }).join('\n');
}

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

  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (!title) throw new Error(`Missing article title in ${sourceReadme}`);

  const assetPrefix = `/content-assets/${entry.name}/`;
  const publishable = renderHighlights(markdown)
    .replace(/^---\r?\n/, `---\ntitle: ${JSON.stringify(title)}\n`)
    .replace(/^#\s+.+$(?:\r?\n)*/m, '')
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
