import { RECIPES, options, type Need, type Recipe } from '../data/recipes';
import { findExact } from '../data/catalog';
import type { DayString, FridgeItem } from '../types';
import { daysLeft, isUrgent, qualityOnly, urgency } from './freshness';
import { today } from './dates';

export interface Suggestion {
  recipe: Recipe;
  /** Tarifte kullanılacak dolaptaki ürünler (şart ve isteğe bağlı; her grup için en acil olanı). */
  uses: FridgeItem[];
  /** Eksik ŞART malzeme grupları (seçenekleriyle). Boşsa tarif elindekilerle yapılır. */
  missing: string[][];
  /** Eksik isteğe bağlı malzeme grupları: olmasa da olur. */
  optionalMissing: string[][];
  /** Kullanılan ürünlerden son günü yaklaşan (bozulmamış) kaç tanesini değerlendiriyor. Öneridir, tüketim kaydı değil. */
  rescues: number;
  score: number;
}

/** "Az eksiği olanlar" en fazla bu kadar şart malzeme eksik olan tarifleri gösterir. */
export const MAX_MISSING = 2;

/**
 * Bir ürünün tarifi öne çıkarma ağırlığı: son güne ne kadar yakınsa o kadar yüksek; acil olmayanlar 0
 * (2 yıllık şeker, tarifi acil ürün kullananın önüne geçmesin). Çiğ et ve pişmiş yemek riskli olduğu için 2 kat.
 */
function weight(i: FridgeItem, leadDays: number, ref: DayString): number {
  const u = urgency(i, leadDays, ref);
  if (u !== 'today' && u !== 'soon') return 0;
  const left = Math.max(0, daysLeft(i, ref));
  const risk = i.category === 'et' || i.category === 'yemek' ? 2 : i.category === 'sut' ? 1.2 : 1;
  return (30 / (left + 1)) * risk;
}

/** Ürünün tariflerde hangi katalog ürünü yerine geçtiği (özel ürünler dahil). */
export function recipeKey(i: FridgeItem): string | undefined {
  if (i.catalogId) return i.catalogId;
  const exact = findExact(i.name);
  if (exact) return exact.id;
  return i.category === 'yemek' ? 'ev-yemegi' : undefined;
}

/** Kurtarılan ürün: tarifte kullanılan, bozulmamış (tarihi geçmemiş) ve son günü yaklaşan; dondurucudakiler sayılmaz. */
export const rescuesItem = (i: FridgeItem, leadDays: number, ref: DayString) => i.storage !== 'freezer' && daysLeft(i, ref) >= 0 && isUrgent(i, leadDays, ref);

/** Dolaptakilere göre tarifleri, bozulmak üzere olanları kullananlar önde olacak şekilde sıralar. Ana malzemesi (ilk grup) yoksa tarif önerilmez. */
export function suggestRecipes(items: FridgeItem[], leadDays: number, ref: DayString = today()): Suggestion[] {
  // Tarihi geçmiş ama yalnızca kalitesi düşen (donuk, kuru) ürünler de "önce bunu kullan" diye tariflere girer.
  const usable = items.filter((i) => (daysLeft(i, ref) >= 0 || qualityOnly(i)) && recipeKey(i));
  const out: Suggestion[] = [];

  for (const recipe of RECIPES) {
    const uses: FridgeItem[] = [];
    /** Grup için dolaptan en uygun ürünü seçer; bulunamazsa undefined. */
    const pick = (need: Need) => {
      const opts = options(need);
      // Önce dolaptaki/kilerdeki, yoksa dondurucudaki; aynı yerde en acil olan.
      return usable
        .filter((i) => opts.includes(recipeKey(i)!) && !uses.includes(i))
        .sort(
          (a, b) =>
            Number(a.storage === 'freezer') - Number(b.storage === 'freezer') ||
            daysLeft(a, ref) - daysLeft(b, ref) ||
            // Aynı gün: önce açık paket (yenisini açmadan açık olanı bitir).
            Number(!!b.opened) - Number(!!a.opened) ||
            // Eşitlikte tarifin adını aldığı ilk seçenek (Peynirli Tost → kaşar).
            opts.indexOf(recipeKey(a)!) - opts.indexOf(recipeKey(b)!),
        )[0];
    };
    const missing: string[][] = [];
    let mainMissing = false;
    recipe.needs.forEach((need, idx) => {
      const found = pick(need);
      if (found) uses.push(found);
      else {
        missing.push(options(need));
        if (idx === 0) mainMissing = true;
      }
    });
    if (mainMissing || missing.length > MAX_MISSING) continue;
    const required = uses.length;
    const optionalMissing: string[][] = [];
    for (const need of recipe.optional ?? []) {
      const found = pick(need);
      if (found) uses.push(found);
      else optionalMissing.push(options(need));
    }
    // "Artıkları değerlendir": bütün artan yemekler birlikte.
    if (recipe.id === 'kalan-yemek') for (const i of usable) if (recipe.needs.flat().includes(recipeKey(i)!) && !uses.includes(i)) uses.push(i);
    const coverage = required / recipe.needs.length;
    const fresh = uses.filter((i) => i.storage !== 'freezer');
    // Artıklarda varsayılan olarak yalnızca en acil olan yenir: rozet onu sayar.
    const rescues = (recipe.id === 'kalan-yemek' ? uses.slice(0, 1) : uses).filter((i) => rescuesItem(i, leadDays, ref)).length;
    const urgencyScore = fresh.reduce((s, i) => s + weight(i, leadDays, ref), 0);
    out.push({ recipe, uses, missing, optionalMissing, rescues, score: urgencyScore * 3 + coverage * 6 - missing.length * 4 - optionalMissing.length * 0.5 });
  }

  return out.sort((a, b) => b.score - a.score);
}
