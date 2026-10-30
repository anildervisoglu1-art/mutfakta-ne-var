import { RECIPES } from '../data/recipes';
import { addDays, diffDays, longDate, relativeDay } from './dates';
import { canFreeze, untilPhrase } from './freshness';
import { recipeKey } from './suggest';
import type { DayString, FridgeItem, Plan } from '../types';

/** "Bugün", "Yarın", "Pazar" (bu hafta), sonrası "2 Kasım Pazartesi". Geçmiş gün: "Dün", "3 gün önce". */
export function planDayLabel(day: DayString, ref: DayString): string {
  const n = diffDays(day, ref);
  if (n < -1) return `${-n} gün önce`;
  if (n >= 7) return longDate(day, ref);
  return relativeDay(day, ref);
}

/** Plan seçicide gösterilecek günler: bugünden itibaren 7 gün. */
export const nextDays = (ref: DayString, count = 7): DayString[] => Array.from({ length: count }, (_, i) => addDays(ref, i));

/**
 * Plan günü ürünün son gününden sonraysa uyarı. Tarifte yalnızca bağlı ürüne bakılır.
 * Dondurulabiliyorsa öneri olarak söylenir.
 */
export function planWarning(day: DayString, item: FridgeItem | undefined, ref: DayString): string | undefined {
  if (!item || item.storage === 'freezer') return undefined;
  if (diffDays(day, item.useBy) <= 0) return undefined;
  const last = planDayLabel(item.useBy, ref);
  const tip = canFreeze(item, ref) ? ' Günü öne al ya da şimdiden dondur.' : ' Günü öne almayı düşün.';
  const until = untilPhrase(day, ref);
  return `${item.name} ${last === 'Bugün' || last === 'Yarın' ? last.toLocaleLowerCase('tr') : last} son günü; ${/^(Yarına|Bugüne)/.test(until) ? until.toLocaleLowerCase('tr') : until} dayanmayabilir.${tip}`;
}

/** Ne yapılacağı için öneriler: bu ürünü kullanan tarifler, sonra ürüne göre genel seçenekler. */
export function planIdeas(item: Pick<FridgeItem, 'name' | 'category'> & Partial<Pick<FridgeItem, 'catalogId'>>): string[] {
  const key = recipeKey(item as FridgeItem);
  const recipes = key ? RECIPES.filter((r) => r.needs.some((n) => (Array.isArray(n) ? n.includes(key) : n === key))).map((r) => r.name) : [];
  const generic: Record<string, string[]> = {
    et: ['Kavurma', 'Izgara', 'Fırında'],
    sebze: [`${item.name} yemeği`, 'Salata'],
    meyve: ['Kahvaltıda', 'Tatlıda'],
    sut: ['Kahvaltıda', 'Tatlıda'],
    yemek: ['Akşam yemeğinde', 'Öğlen yemeğinde'],
    firin: ['Kahvaltıda'],
  };
  const all = [...recipes.slice(0, 4), ...(generic[item.category] ?? ['Kullanacağım'])];
  return all.filter((x, i) => all.indexOf(x) === i).slice(0, 6);
}

/** Ana ekranda gösterilecek planlar: geçmişte kalmış (yapılmadı) + önümüzdeki 7 gün. */
export function visiblePlans(plans: Plan[], ref: DayString): Plan[] {
  return plans.filter((p) => diffDays(p.day, ref) < 7).sort((a, b) => a.day.localeCompare(b.day));
}
