// public/icons/logo.svg dosyasından PWA PNG ikonlarını üretir (Playwright ile).
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icons/logo.svg', import.meta.url), 'utf8');
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.12 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const inner = t.pad ? svg.replace('rx="14"', 'rx="0"') : svg.replace('rx="14"', 'rx="0"');
  const scale = 1 + t.pad * 2;
  const html = `<html><body style="margin:0;background:#1D7A4E;width:${t.size}px;height:${t.size}px;display:grid;place-items:center">
    <div style="width:${t.size}px;height:${t.size}px;transform:scale(${1 / scale})">${inner.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)}</div></body></html>`;
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(html);
  await page.screenshot({ path: `public/icons/${t.file}`, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  console.warn(`ikon: ${t.file}`);
}
await browser.close();
