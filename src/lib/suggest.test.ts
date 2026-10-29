import { describe, expect, it } from 'vitest';
import { suggestRecipes } from './suggest';
import { addDays } from './dates';
import type { FridgeItem } from '../types';
import { getCatalogItem } from '../data/catalog';

const REF = '2026-10-26';
let n = 0;
const item = (catalogId: string, left = 10, over: Partial<FridgeItem> = {}): FridgeItem => {
  const c = getCatalogItem(catalogId)!;
  return { id: `i${n++}`, catalogId, name: c.name, img: c.img, category: c.category, storage: 'fridge', quantity: 1, addedAt: addDays(REF, -2), useBy: addDays(REF, left), opened: false, dateSource: 'auto', ...over };
};
const find = (items: FridgeItem[], id: string) => suggestRecipes(items, 2, REF).find((s) => s.recipe.id === id);
const ready = (items: FridgeItem[]) => suggestRecipes(items, 2, REF).filter((s) => s.missing.length === 0).map((s) => s.recipe.id);

describe('tarif önerileri', () => {
  it('eksik şart malzeme bildirilir ve tarif "Elimdekilerle"de çıkmaz', () => {
    // Zeytinyağlı Ispanak: ıspanak + soğan şart; soğan yok.
    const items = [item('ispanak', 1), item('pirinc', 200)];
    const s = find(items, 'ispanak-yemegi')!;
    expect(s).toBeDefined();
    expect(s.missing).toEqual([['sogan']]);
    expect(ready(items)).not.toContain('ispanak-yemegi');
  });
  it('seçeneklerden biri grubu karşılar', () => {
    // Yumurtalı Ispanak: soğan YA DA sarımsak.
    const items = [item('ispanak', 1), item('yumurta', 20), item('sarimsak', 30)];
    const s = find(items, 'ispanakli-yumurta')!;
    expect(s.missing).toEqual([]);
    expect(ready(items)).toContain('ispanakli-yumurta');
  });
  it('isteğe bağlı malzeme eksikse tarif yine elindekilerle yapılır', () => {
    const items = [item('ispanak', 1), item('sogan', 30)];
    const s = find(items, 'ispanak-yemegi')!;
    expect(s.missing).toEqual([]);
    expect(s.optionalMissing.map((g) => g[0])).toEqual(['pirinc', 'yogurt']);
    expect(ready(items)).toContain('ispanak-yemegi');
  });
  it('varsa isteğe bağlı malzeme de kullanılır', () => {
    const items = [item('ispanak', 1), item('sogan', 30), item('pirinc', 200)];
    const s = find(items, 'ispanak-yemegi')!;
    expect(s.uses.map((u) => u.catalogId)).toEqual(['ispanak', 'sogan', 'pirinc']);
  });
  it('ana malzeme yoksa ya da ikiden fazla şart eksikse önerilmez', () => {
    expect(find([item('sogan', 30)], 'ispanak-yemegi')).toBeUndefined();
    // Etli Nohut: nohut var; et, soğan, salça/domates yok → 3 eksik.
    expect(find([item('nohut', 200)], 'nohut-yemegi')).toBeUndefined();
  });
  it('yalnızca kullanılan, bozulmamış ve acil ürünler "değerlendirir" sayılır', () => {
    const items = [
      item('yumurta', 1), // acil, kullanılıyor
      item('domates', 0), // bugün son gün, kullanılıyor
      item('biber', 20), // acil değil
      item('cilek', 0), // acil ama menemende yok
      item('sogan', -1), // tarihi geçmiş: kullanılmaz, sayılmaz
    ];
    const s = find(items, 'menemen')!;
    expect(s.missing).toEqual([]);
    expect(s.rescues).toBe(2);
    expect(s.uses.some((u) => u.catalogId === 'sogan')).toBe(false);
  });
  it('dondurucudaki ürün kurtarılan sayılmaz', () => {
    const items = [item('kiyma', 1, { storage: 'freezer' }), item('sogan', 30), item('ekmek', 2)];
    const s = find(items, 'kofte-patates')!;
    expect(s.missing).toEqual([]);
    expect(s.rescues).toBe(1); // yalnızca ekmek
  });
});
