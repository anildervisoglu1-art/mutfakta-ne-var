// Görsel kontrol: üretim derlemesini açar, ana akışların ekran görüntülerini qa/ içine kaydeder.
// Kullanım: npm run build && npx vite preview --port 4174 & node scripts/shots.mjs [url]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://localhost:4174/';
await mkdir('qa', { recursive: true });
const browser = await chromium.launch();

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, locale: 'tr-TR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = (name) => page.screenshot({ path: `qa/${scheme}-${name}.png` });

  await page.goto(url);
  await page.waitForTimeout(400);
  await shot('01-empty');
  await page.getByRole('button', { name: 'Önce örnek mutfakla dene' }).click();
  await page.waitForTimeout(700);
  await shot('02-home');
  await page.screenshot({ path: `qa/${scheme}-02b-home-full.png`, fullPage: true });

  await page.getByRole('button', { name: /^Ispanak,/ }).click();
  await page.waitForTimeout(500);
  await shot('03-item');
  await page.getByRole('button', { name: 'Kapat', exact: true }).click();

  await page.getByRole('button', { name: 'Ürün ekle' }).click();
  await page.waitForTimeout(650);
  await shot('04-add-intro');
  await page.waitForTimeout(1100);
  await shot('05-add');
  await page.getByRole('button', { name: /^Süt, ayrıntılarla/ }).first().click();
  await page.waitForTimeout(500);
  await shot('06-draft');
  await page.getByRole('button', { name: 'Buzdolabına ekle' }).click();
  await page.waitForTimeout(350);
  await shot('07-flying');
  await page.waitForTimeout(800);
  await shot('08-added');
  await page.getByRole('button', { name: 'Tamam', exact: true }).click();

  await page.getByRole('button', { name: 'Tarifler', exact: true }).click();
  await page.waitForTimeout(500);
  await shot('09-cook');
  await page.getByRole('button', { name: 'Bunu pişirdim' }).first().click();
  await page.waitForTimeout(400);
  await shot('10-cooked');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();

  await page.getByRole('button', { name: 'Özet', exact: true }).click();
  await page.waitForTimeout(700);
  await shot('11-stats');
  await page.getByRole('button', { name: 'Ayarlar', exact: true }).click();
  await page.waitForTimeout(400);
  await shot('12-settings');

  if (errors.length) console.warn(scheme, 'HATALAR:', errors);
  await ctx.close();
}
await browser.close();
console.warn('qa/ hazır');
