import { describe, expect, it } from 'vitest';
import { RECIPES, options } from '../data/recipes';
import { getCatalogItem } from '../data/catalog';
import { searchKey } from '../data/catalog';

const allIds = (r: (typeof RECIPES)[number]) => [...r.needs, ...(r.optional ?? [])].flatMap(options);

/** Adın vaat ettiği malzeme (Sucuklu → sucuk): tarifte ŞART olmalı. */
const PROMISES: [RegExp, string[]][] = [
  [/sucuklu/, ['sucuk']],
  [/sosisli/, ['sosis']],
  [/peynirli/, ['beyaz-peynir', 'kasar', 'lor', 'labne']],
  [/kasarli/, ['kasar']],
  [/cevizli/, ['ceviz']],
  [/muzlu/, ['muz']],
  [/yumurtali/, ['yumurta']],
  [/ispanak/, ['ispanak']],
  [/tavuk/, ['tavuk']],
  [/etli/, ['kirmizi-et', 'kiyma']],
  [/tereyagli/, ['tereyagi']],
  [/domatesli/, ['domates']],
  [/balli/, ['bal']],
  [/kaymak/, ['kaymak']],
  [/mercimek/, ['mercimek']],
  [/bulgur/, ['bulgur']],
  [/makarna/, ['makarna', 'kuru-makarna']],
  [/kofte/, ['kiyma']],
  [/mantar/, ['mantar']],
  [/^(?!kuru ).*patlican/, ['patlican']],
  [/brokoli/, ['brokoli']],
  [/elma/, ['elma', 'yesil-elma']],
  [/meyveli/, ['muz', 'elma', 'cilek']],
  [/tahin/, ['tahin']],
  [/pekmez/, ['pekmez']],
  [/lahana/, ['lahana']],
];

describe('tarifler', () => {
  it('her malzeme katalogda var', () => {
    const missing = RECIPES.flatMap((r) => allIds(r).filter((id) => !getCatalogItem(id)).map((id) => `${r.id}:${id}`));
    expect(missing).toEqual([]);
  });
  it('kimlikler benzersiz', () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });
  it('her tarifte en az bir şart grup var ve hiçbir grup boş değil', () => {
    for (const r of RECIPES) {
      expect(r.needs.length, r.id).toBeGreaterThan(0);
      for (const g of [...r.needs, ...(r.optional ?? [])]) expect(options(g).length, r.id).toBeGreaterThan(0);
    }
  });
  it('bir malzeme hem şart hem isteğe bağlı değil', () => {
    for (const r of RECIPES) {
      const req = new Set(r.needs.flatMap(options));
      for (const id of (r.optional ?? []).flatMap(options)) expect(req.has(id), `${r.id}: ${id}`).toBe(false);
    }
  });
  it('adın vaat ettiği malzeme şart', () => {
    for (const r of RECIPES) {
      const name = searchKey(r.name);
      for (const [re, ids] of PROMISES) {
        if (!re.test(name)) continue;
        const ok = r.needs.some((g) => options(g).some((id) => ids.includes(id)));
        expect(ok, `${r.name} → ${ids.join('/')}`).toBe(true);
      }
    }
  });
  it('Zeytinyağlı Ispanak: soğan ve pirinç birbirinin yerine geçmez', () => {
    const r = RECIPES.find((x) => x.id === 'ispanak-yemegi')!;
    for (const g of [...r.needs, ...(r.optional ?? [])]) {
      const o = options(g);
      expect(o.includes('sogan') && o.includes('pirinc')).toBe(false);
    }
  });
});
