// Katalog ve tariflerde geçen emojilerin Twemoji SVG'lerini public/food içine kopyalar.
// Twemoji grafikleri CC-BY 4.0 lisanslıdır (bkz. CREDITS.md).
import { copyFile, readFile, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const sources = ['src/data/catalog.ts', 'src/data/recipes.ts'];
const custom = new Set(['mantar', 'nar', 'badem', 'findik', 'ceviz', 'antep', 'kaju', 'mercimek', 'nohut', 'un', 'irmik', 'yulaf', 'kayisi', 'hurma', 'seker', 'pekmez', 'cips', 'donuk-sebze']);
const stems = new Set();

const emojiToStem = (emoji) => {
  const cps = Array.from(emoji).map((c) => c.codePointAt(0).toString(16));
  return (emoji.includes('‍') ? cps : cps.filter((c) => c !== 'fe0f')).join('-');
};

for (const file of sources) {
  const text = await readFile(new URL(file, root), 'utf8');
  // Tırnak içindeki her emoji (img alanları ve ek görsel listeleri)
  for (const [, img] of text.matchAll(/'(\p{Extended_Pictographic}[^']*)'/gu)) stems.add(emojiToStem(img));
}

const twemoji = new URL('node_modules/@twemoji/svg/', root);
for (const stem of stems) {
  const src = new URL(`${stem}.svg`, twemoji);
  if (!existsSync(src)) throw new Error(`Twemoji görseli yok: ${stem}`);
  await copyFile(src, new URL(`public/food/${stem}.svg`, root));
}

// Artık kullanılmayanları temizle
for (const f of await readdir(new URL('public/food/', root))) {
  const stem = f.replace(/\.svg$/, '');
  if (!stems.has(stem) && !custom.has(stem)) await unlink(new URL(`public/food/${f}`, root));
}
// Bozuk SVG yayına çıkmasın: her dosyanın tek kök <svg> ve tekrarsız öznitelik içerdiğini kontrol et.
for (const f of await readdir(new URL('public/food/', root))) {
  const text = await readFile(new URL(`public/food/${f}`, root), 'utf8');
  if (!/^<svg[\s\S]*<\/svg>\s*$/.test(text.trim())) throw new Error(`Geçersiz SVG: ${f}`);
  for (const [, attrs] of text.matchAll(/<\w+([^>]*)>/g)) {
    const names = [...attrs.matchAll(/\s([\w:-]+)=/g)].map((m) => m[1]);
    if (new Set(names).size !== names.length) throw new Error(`Tekrarlanan öznitelik: ${f}`);
  }
}
console.warn(`${stems.size} görsel kopyalandı.`);
