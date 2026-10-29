import { addDays } from '../lib/dates';
import { getCatalogItem } from './catalog';
import type { DayString, FridgeItem, StorageId } from '../types';

/** [katalog id, kaç gün önce eklendi, kaç gün kaldı, miktar, yer, açıldı mı] */
const DEMO: [string, number, number, number, StorageId?, boolean?][] = [
  ['ispanak', 3, 0, 1],
  ['tavuk', 1, 1, 1],
  ['yogurt', 6, 1, 1, 'fridge', true],
  ['domates', 4, 2, 5],
  ['cilek', 1, 2, 1],
  ['muz', 3, 2, 4, 'counter'],
  ['maydanoz', 2, 4, 1],
  ['beyaz-peynir', 5, 5, 1, 'fridge', true],
  ['biber', 2, 8, 4],
  ['yumurta', 4, 24, 10],
  ['elma', 3, 25, 6],
  ['kasar', 2, 28, 1],
  ['havuc', 2, 19, 6],
  ['kiyma', 10, 110, 2, 'freezer'],
  ['ekmek', 0, 3, 1, 'counter'],
  ['ceviz', 20, 12, 1, 'pantry'],
  ['pirinc', 60, 300, 1, 'pantry'],
  ['mercimek', 30, 330, 1, 'pantry'],
];

export function buildDemoItems(ref: DayString): FridgeItem[] {
  return DEMO.flatMap(([catalogId, ago, left, quantity, storage, opened], index) => {
    const c = getCatalogItem(catalogId);
    if (!c) return [];
    return [
      {
        id: `demo-${index}`,
        catalogId,
        name: c.name,
        img: c.img,
        category: c.category,
        storage: storage ?? 'fridge',
        quantity,
        addedAt: addDays(ref, -ago),
        useBy: addDays(ref, left),
        opened: opened ?? false,
        dateSource: 'auto' as const,
        baseUseBy: addDays(ref, left),
        // Örnekteki açık ürünün açılma günü kalan süresiyle tutarlıdır (son gün = açılma + açık ömrü).
        ...(opened ? { openedAt: c.opened !== undefined && left - c.opened > -ago ? addDays(ref, left - c.opened) : addDays(ref, -ago) } : {}),
      },
    ];
  });
}
