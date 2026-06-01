import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const workbenchDir = resolve(scriptDir, '../../../..');

function printHelp() {
  console.log(`Usage:
  node .agents/skills/ui-distill/scripts/capture-html.mjs --page <path> --width <px> --height <px> --output <path>
  node .agents/skills/ui-distill/scripts/capture-html.mjs --url <url> --width <px> --height <px> --output <path>

Options:
  --page <path>    HTML file path relative to the workbench root, for example pages/app.html.
  --url <url>      Absolute URL to capture. Use either --page or --url, not both.
  --width <px>     Viewport width in CSS pixels.
  --height <px>    Viewport height in CSS pixels.
  --output <path>  Screenshot output path relative to the workbench root.
  --help           Show this help.

Examples:
  node .agents/skills/ui-distill/scripts/capture-html.mjs --page pages/app.html --width 1179 --height 2556 --output .tmp/app.png
  node .agents/skills/ui-distill/scripts/capture-html.mjs --url http://127.0.0.1:4173/pages/app.html --width 1179 --height 2556 --output .tmp/app.png`);
}

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

function argValue(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  return args[index + 1] || fallback;
}

const pagePath = argValue('--page', null);
const explicitUrl = argValue('--url', null);
const outputPath = argValue('--output', null);
const widthValue = argValue('--width', null);
const heightValue = argValue('--height', null);

if (!pagePath && !explicitUrl) {
  throw new Error('Pass either --page <path> or --url <url>. Use --help for usage.');
}

if (pagePath && explicitUrl) {
  throw new Error('Pass only one of --page or --url. Use --help for usage.');
}

if (!outputPath) {
  throw new Error('Pass --output <path>. Use --help for usage.');
}

if (!widthValue || !heightValue) {
  throw new Error('Pass --width <px> and --height <px>. Use --help for usage.');
}

const url = explicitUrl || pathToFileURL(resolve(workbenchDir, pagePath)).href;
const output = resolve(workbenchDir, outputPath);
const width = Number(widthValue);
const height = Number(heightValue);

if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
  throw new Error('--width and --height must be positive numbers');
}

await mkdir(dirname(output), { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
});
const page = await browser.newPage({ viewport: { width, height } });

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const canvas = await page.locator('#canvas').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  });

  await page.screenshot({ path: output, fullPage: false });

  console.log(JSON.stringify({ url, output, viewport: { width, height }, canvas }, null, 2));
} finally {
  await browser.close();
}
