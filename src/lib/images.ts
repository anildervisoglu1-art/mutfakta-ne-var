/** Emoji'yi Twemoji dosya adına çevirir (ZWJ içermeyenlerde FE0F atılır). */
export function emojiToStem(emoji: string): string {
  const cps = Array.from(emoji).map((c) => c.codePointAt(0)!.toString(16));
  return (emoji.includes('‍') ? cps : cps.filter((c) => c !== 'fe0f')).join('-');
}

/** Görsel adı ya emoji ya da `public/food` içindeki özel bir dosyadır. */
export function foodImageUrl(img: string): string {
  const stem = /^[a-z0-9-]+$/.test(img) ? img : emojiToStem(img);
  return `${import.meta.env.BASE_URL}food/${stem}.svg`;
}
