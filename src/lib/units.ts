import { getCatalogItem } from '../data/catalog';
import type { CategoryId, FridgeItem, Level, Unit } from '../types';

/** Birimlerin okunuşu. */
export const UNIT_LABEL: Record<Unit, string> = {
  adet: 'adet',
  paket: 'paket',
  kutu: 'kutu',
  sise: 'şişe',
  kavanoz: 'kavanoz',
  kap: 'kap',
  porsiyon: 'porsiyon',
  demet: 'demet',
};

/** Ekleme formunda seçilebilen birimler (sırayla). */
export const UNITS: Unit[] = ['adet', 'paket', 'kutu', 'sise', 'kavanoz', 'demet', 'kap', 'porsiyon'];

/** Katalogda birimi belli olan ürünler; geri kalanlar kategoriden gelir. */
const BY_ID: Record<string, Unit> = {
  sut: 'sise',
  'sut-uht': 'kutu',
  'cig-sut': 'sise',
  ayran: 'sise',
  kefir: 'sise',
  'meyve-suyu': 'kutu',
  kola: 'sise',
  'maden-suyu': 'sise',
  yogurt: 'kutu',
  krema: 'kutu',
  kaymak: 'paket',
  labne: 'kutu',
  lor: 'paket',
  'beyaz-peynir': 'paket',
  kasar: 'paket',
  tereyagi: 'paket',
  yumurta: 'adet',
  'haslanmis-yumurta': 'adet',
  zeytin: 'kavanoz',
  bal: 'kavanoz',
  recel: 'kavanoz',
  tahin: 'kavanoz',
  pekmez: 'sise',
  tursu: 'kavanoz',
  salca: 'kavanoz',
  mayonez: 'paket',
  ketcap: 'paket',
  'findik-kremasi': 'kavanoz',
  'sivi-yag': 'sise',
  'zeytinyagi': 'sise',
  sirke: 'sise',
  'nar-eksisi': 'sise',
  'konserve-kapali': 'kutu',
  konserve: 'kutu',
  maydanoz: 'demet',
  dereotu: 'demet',
  nane: 'demet',
  roka: 'demet',
  'taze-sogan': 'demet',
  ispanak: 'demet',
  semizotu: 'demet',
  pazi: 'demet',
  ekmek: 'adet',
  baget: 'adet',
  simit: 'adet',
  pogaca: 'adet',
  lavas: 'paket',
  yufka: 'paket',
  buz: 'paket',
  dondurma: 'kutu',
  'bebek-mamasi': 'kutu',
  'hazir-mama': 'kap',
  'meyve-puresi': 'kavanoz',
  cilek: 'kutu',
  'yaban-mersini': 'kutu',
  ahududu: 'kutu',
  'dut': 'kutu',
};

const BY_CATEGORY: Record<CategoryId, Unit> = {
  meyve: 'adet',
  sebze: 'adet',
  sut: 'paket',
  et: 'paket',
  yemek: 'kap',
  firin: 'adet',
  icecek: 'sise',
  sos: 'kavanoz',
  kuru: 'paket',
  kuruyemis: 'paket',
  temel: 'paket',
  atistirmalik: 'paket',
  donuk: 'paket',
};

/** Ürüne uygun varsayılan birim. */
export function defaultUnit(item: { catalogId?: string; category: CategoryId }): Unit {
  const byId = item.catalogId ? BY_ID[item.catalogId] : undefined;
  if (byId) return byId;
  const cat = getCatalogItem(item.catalogId);
  return BY_CATEGORY[cat?.category ?? item.category];
}

export const unitOf = (item: Pick<FridgeItem, 'category'> & Partial<Pick<FridgeItem, 'unit' | 'catalogId'>>): Unit => item.unit ?? defaultUnit(item);

/** Tek tek sayılan birimler (yumurta, elma). Diğerleri kap/paket: açılınca "Tam / Yarım / Az kaldı" sorulabilir. */
export const isCountable = (unit: Unit) => unit === 'adet' || unit === 'demet' || unit === 'porsiyon';
/** Doluluk (Tam / Yarım / Az kaldı) sorulabilen birimler. */
export const hasLevel = (unit: Unit) => !isCountable(unit);

/** "3 adet", "1 şişe", "2 kap". */
export const qtyText = (n: number, unit: Unit) => `${n} ${UNIT_LABEL[unit]}`;

export const LEVEL_LABEL: Record<Level, string> = { full: 'Tam', half: 'Yarım', low: 'Az kaldı' };
/** "Biraz kullandım": doluluk bir basamak iner; "Az kaldı"da kalır (silinmez). */
export const lowerLevel = (level: Level | undefined): Level => (level === undefined || level === 'full' ? 'half' : 'low');
