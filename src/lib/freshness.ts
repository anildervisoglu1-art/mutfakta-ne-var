import { CUSTOM_DAYS, PERISHABLE, getCatalogItem } from '../data/catalog';
import type { CatalogItem, CategoryId, DayString, FridgeItem, StorageId, Urgency } from '../types';
import { addDays, diffDays, longDate, parseDay, roughDuration, today, weekday } from './dates';

/** Katalog ürünü için önerilen tüketme günü. */
export function suggestUseBy(item: CatalogItem, storage: StorageId, opened: boolean, from: DayString = today()): DayString {
  const base = item.days[storage] ?? item.days.fridge ?? Object.values(item.days)[0] ?? 3;
  const days = opened && item.opened !== undefined && storage !== 'freezer' ? Math.min(base, item.opened) : base;
  return addDays(from, days);
}

/** Katalogda olmayan ürün için kategori ve yere göre temkinli tahmin. */
export function suggestCustomUseBy(category: CategoryId, storage: StorageId, from: DayString = today()): DayString {
  const d = CUSTOM_DAYS[category];
  return addDays(from, d[storage] ?? Math.min(...Object.values(d)));
}

/** Özel ürünün kategorisine uygun saklama yerleri. */
export const customStorages = (category: CategoryId): StorageId[] => Object.keys(CUSTOM_DAYS[category]) as StorageId[];

/** Pratikte bozulmayan ürün (buz, şeker, tuz, bal). */
export const isStable = (item: Pick<FridgeItem, 'catalogId'>) => getCatalogItem(item.catalogId)?.stable === true;

/** Paketle kullanılan kiler ürünleri: bir yemekte "biraz" kullanılır, paket bitince düşülür. */
export const BULK: ReadonlySet<CategoryId> = new Set<CategoryId>(['kuru', 'kuruyemis', 'temel', 'sos']);
export const isBulk = (item: Pick<FridgeItem, 'category'>) => BULK.has(item.category);

/** Çiğ yenmeyen, yalnızca yemekte kullanılan sebze ve yeşillikler. */
const COOK_ONLY: ReadonlySet<string> = new Set(['patlican', 'kabak', 'pirasa', 'ispanak', 'pazi', 'maydanoz', 'dereotu', 'nane', 'bamya', 'kereviz', 'lahana', 'bal-kabagi', 'patates', 'taze-fasulye']);

/** Ürüne göre ne denir: meyve-sebzede "Yedim", çiğ ette ve pişirilen sebzede "Kullandım", birkaç öğünde biten şeylerde "Bitti". */
export const finishVerb = (item: Pick<FridgeItem, 'category'> & Partial<Pick<FridgeItem, 'catalogId'>>): 'Yedim' | 'Kullandım' | 'Bitti' => {
  if (item.category === 'sebze' && item.catalogId && COOK_ONLY.has(item.catalogId)) return 'Kullandım';
  return item.category === 'meyve' || item.category === 'sebze' ? 'Yedim' : item.category === 'et' ? 'Kullandım' : 'Bitti';
};

/** Açılınca: tarih, açıldıktan sonraki süreyi aşamaz (asla uzamaz). */
export function capForOpened(useBy: DayString, openedDays: number | undefined, ref: DayString = today()): DayString {
  if (openedDays === undefined) return useBy;
  const capped = addDays(ref, openedDays);
  return diffDays(capped, useBy) < 0 ? capped : useBy;
}

export function daysLeft(item: Pick<FridgeItem, 'useBy'>, ref: DayString = today()): number {
  return diffDays(item.useBy, ref);
}

/** Toplam saklama süresi (eklenme → tüketme günü), en az 1. */
export function totalDays(item: Pick<FridgeItem, 'useBy' | 'addedAt'>): number {
  return Math.max(1, diffDays(item.useBy, item.addedAt));
}

/**
 * Aciliyet yalnızca kalan güne bakar: kalan gün, ayardaki uyarı süresine (1–3) inince
 * ürün "Önce bunları ye" listesine çıkar. Böylece aynı gün kalan ürünler hep aynı renkte görünür.
 */
type UrgencyInput = Pick<FridgeItem, 'useBy'> & Partial<Pick<FridgeItem, 'catalogId' | 'storage' | 'category' | 'addedAt' | 'opened' | 'dateSource' | 'packageKind'>>;

/**
 * Tarihi geçince "atılmalı" değil, yalnızca "kalitesi düşmüş olabilir" sayılan ürün:
 * dondurucudakiler (−18 °C'de güvenli kalır) ve kuru gıda/atıştırmalık gibi bozulması yavaş olanlar.
 */
export function qualityOnly(item: Partial<Pick<FridgeItem, 'storage' | 'category' | 'catalogId' | 'opened' | 'dateSource' | 'packageKind'>>): boolean {
  // Bebek maması: açıldıktan sonraki süre güvenlikle ilgilidir.
  if (item.catalogId === 'bebek-mamasi' || item.catalogId === 'hazir-mama' || (item.catalogId === 'sut-tozu' && item.opened)) return false;
  if (item.storage === 'freezer') return true;
  // Kullanıcı paketteki tarihin türünü seçtiyse o geçerlidir: STT geçince tüketilmez, kapalı üründe TETT yalnızca kaliteyi anlatır.
  if (item.dateSource === 'package' && item.packageKind === 'stt') return false;
  if (item.dateSource === 'package' && item.packageKind === 'tett' && !item.opened) return true;
  // Türü bilinmeyen paket tarihi geçtiyse "kalitesi düşmüş olabilir" diye geçiştirilmez: kontrol edip karar verilir.
  if (item.dateSource === 'package' && (item.packageKind ?? 'unknown') === 'unknown') return false;
  // Kapalı kavanoz/konserve/UHT süt: paketteki tarih TETT'tir (kalite).
  if (getCatalogItem(item.catalogId)?.tett && !item.opened) return true;
  // Çözülmüş donuk ürün artık taze üründür.
  if (item.category === 'donuk') return false;
  return item.category !== undefined && !PERISHABLE.has(item.category);
}

/** Uyarı penceresi: ayardaki 1–3 gün; aylarca dayanan ürünlerde süreye göre uzar (en fazla 30 gün). */
export function leadFor(item: UrgencyInput, leadDays: number): number {
  if (!item.addedAt) return leadDays;
  const total = diffDays(item.useBy, item.addedAt);
  return total > 60 ? Math.min(30, Math.max(leadDays, Math.round(total * 0.08))) : leadDays;
}

export function urgency(item: UrgencyInput, leadDays: number, ref: DayString = today()): Urgency {
  if (isStable(item)) return 'fresh';
  const left = daysLeft(item, ref);
  if (left < 0) return qualityOnly(item) ? 'soon' : 'expired';
  if (left === 0) return 'today';
  if (left <= leadFor(item, leadDays)) return 'soon';
  return 'fresh';
}

export const isUrgent = (item: UrgencyInput, leadDays: number, ref: DayString = today()) => ['today', 'soon'].includes(urgency(item, leadDays, ref));

/** Kalan sürenin oranı (0–1), halka göstergesi için. */
export function remainingRatio(item: Pick<FridgeItem, 'useBy' | 'addedAt'>, ref: DayString = today()): number {
  const left = daysLeft(item, ref);
  return Math.max(0, Math.min(1, left / totalDays(item)));
}

const WEEKDAY_DATIVE: Record<string, string> = {
  Pazartesi: "Pazartesi'ye",
  Salı: "Salı'ya",
  Çarşamba: "Çarşamba'ya",
  Perşembe: "Perşembe'ye",
  Cuma: "Cuma'ya",
  Cumartesi: "Cumartesi'ye",
  Pazar: "Pazar'a",
};
const MONTH_DATIVE: Record<string, string> = {
  Ocak: "Ocak'a",
  Şubat: "Şubat'a",
  Mart: "Mart'a",
  Nisan: "Nisan'a",
  Mayıs: "Mayıs'a",
  Haziran: "Haziran'a",
  Temmuz: "Temmuz'a",
  Ağustos: "Ağustos'a",
  Eylül: "Eylül'e",
  Ekim: "Ekim'e",
  Kasım: "Kasım'a",
  Aralık: "Aralık'a",
};

/** Yılın okunuşuna göre yönelme eki: 2027'ye, 2026'ya, 2029'a, 2030'a. */
export function yearDative(y: number): string {
  const ones: Record<number, string> = { 0: '', 1: "'e", 2: "'ye", 3: "'e", 4: "'e", 5: "'e", 6: "'ya", 7: "'ye", 8: "'e", 9: "'a" };
  const tens: Record<number, string> = { 1: "'a", 2: "'ye", 3: "'a", 4: "'a", 5: "'ye", 6: "'a", 7: "'e", 8: "'e", 9: "'a" };
  if (y % 10) return ones[y % 10]!;
  if (y % 100) return tens[Math.floor(y / 10) % 10]!;
  return "'e";
}

/** "Cuma'ya kadar" ya da "19 Kasım'a kadar" gibi doğal bir ifade. */
export function untilPhrase(day: DayString, ref: DayString = today()): string {
  const n = diffDays(day, ref);
  if (n === 0) return 'Bugüne kadar';
  if (n === 1) return 'Yarına kadar';
  if (n > 1 && n < 7) return `${WEEKDAY_DATIVE[weekday(day)]} kadar`;
  const [d, month] = longDate(day, ref).split(' ');
  const y = parseDay(day).getFullYear();
  const year = y !== parseDay(ref).getFullYear() ? ` ${y}${yearDative(y)}` : '';
  // Tarih satır sonunda bölünmesin.
  return year ? `${d}\u00a0${month}${year.replace(' ', '\u00a0')} kadar` : `${d}\u00a0${MONTH_DATIVE[month!] ?? month} kadar`;
}

/** Tüm uygulamada aynı ölçek: "Bugün son gün", "Yarın son gün", "N gün kaldı". */
export function leftLabel(item: UrgencyInput, ref: DayString = today()): string {
  if (isStable(item)) return 'Bozulmaz';
  const left = daysLeft(item, ref);
  if (left < 0 && item.storage === 'freezer') return 'Önce bunu kullan';
  if (left < 0 && qualityOnly(item)) return 'Kontrol et';
  if (left < 0) return `${-left} gün geçti`;
  if (left === 0) return 'Bugün son gün';
  if (left === 1) return 'Yarın son gün';
  if (left > 60) return `${roughDuration(left)} kaldı`;
  return `${left} gün kaldı`;
}

export function urgencyTitle(item: UrgencyInput, leadDays: number, ref: DayString = today()): string {
  if (isStable(item)) return 'Pratikte bozulmaz';
  if (daysLeft(item, ref) < 0 && item.storage === 'freezer') return 'Kalite süresi doldu, önce bunu kullan';
  if (daysLeft(item, ref) < 0 && qualityOnly(item)) return 'Tarihi geçti, kontrol et';
  const u = urgency(item, leadDays, ref);
  if (u === 'expired') return 'Son günü geçti';
  if (u === 'fresh') return `${untilPhrase(item.useBy, ref)} taze`;
  return leftLabel(item, ref);
}

export const URGENCY_ORDER: Record<Urgency, number> = { expired: 0, today: 1, soon: 2, fresh: 3 };

export function sortByUrgency<T extends FridgeItem>(items: T[], ref: DayString = today()): T[] {
  return [...items].sort((a, b) => Number(isStable(a)) - Number(isStable(b)) || daysLeft(a, ref) - daysLeft(b, ref) || a.name.localeCompare(b.name, 'tr'));
}

/** Açıldığında kalan süre kısalır (asla uzamaz). Süre, gerçek açılma gününden sayılır. */
export function useByAfterOpening(item: FridgeItem, openedAt: DayString = today()): DayString {
  return effectiveUseBy({ ...item, opened: true, openedAt });
}

const earlier = (a: DayString, b: DayString) => (diffDays(a, b) <= 0 ? a : b);

/**
 * Kapalıyken geçerli tahmini sınır: alındığı gün (yoksa uygulamaya eklendiği gün) + ortalama saklama süresi.
 * Pişmiş yemekte pişirildiği gün esas alınır.
 */
export function estimateBase(item: Pick<FridgeItem, 'category' | 'storage' | 'addedAt'> & Partial<Pick<FridgeItem, 'catalogId' | 'boughtAt' | 'cookedAt'>>): DayString {
  const from = item.category === 'yemek' ? (item.cookedAt ?? item.boughtAt ?? item.addedAt) : (item.boughtAt ?? item.addedAt);
  const cat = getCatalogItem(item.catalogId);
  return cat ? suggestUseBy(cat, item.storage, false, from) : suggestCustomUseBy(item.category, item.storage, from);
}

/**
 * Geçerli son gün: kapalıyken sınır (paketteki tarih, elle girilen ya da tahmin);
 * açıldıysa bu sınır ile "açıldığı gün + açık ömrü"nden erken olanı.
 */
export function effectiveUseBy(item: Pick<FridgeItem, 'useBy' | 'category' | 'storage' | 'opened'> & Partial<Pick<FridgeItem, 'catalogId' | 'openedAt' | 'baseUseBy'>>): DayString {
  const base = item.baseUseBy ?? item.useBy;
  if (!item.opened || !item.openedAt || item.storage === 'freezer') return base;
  const days = openedDaysFor(item);
  return days === undefined ? base : earlier(base, addDays(item.openedAt, days));
}

/** Dondurucuya taşınınca yeni tüketme günü. */
export function useByInFreezer(item: FridgeItem, ref: DayString = today()): DayString {
  const cat = getCatalogItem(item.catalogId);
  return addDays(ref, cat?.days.freezer ?? CUSTOM_DAYS[item.category].freezer ?? 60);
}

/** Tarihi geçmiş ürün dondurulamaz: dondurmak bozulmuş gıdayı kurtarmaz. Çözülmüş çiğ et tekrar dondurulmaz. */
/** Çözdür: dondurucudaki ürün; buz ve dondurma gibi çözülmeyecekler hariç. */
export const canThaw = (item: FridgeItem) => item.storage === 'freezer' && !isStable(item) && item.catalogId !== 'dondurma';

export function canFreeze(item: FridgeItem, ref: DayString = today()): boolean {
  if (item.storage === 'freezer' || daysLeft(item, ref) < 0 || (item.thawed && item.category === 'et')) return false;
  const cat = getCatalogItem(item.catalogId);
  return cat ? cat.days.freezer !== undefined : CUSTOM_DAYS[item.category].freezer !== undefined;
}

/** "Dondur" önerilecek mi: dondurulabilir ve donunca iyi kalan ürün. */
export function freezeWorthIt(item: FridgeItem, ref: DayString = today()): boolean {
  if (!canFreeze(item, ref)) return false;
  const cat = getCatalogItem(item.catalogId);
  return cat ? cat.freezeTip !== false : !['icecek', 'sos', 'kuru', 'temel', 'atistirmalik'].includes(item.category);
}

/** Açılınca kaç gün dayanır: katalogda varsa o, taze özel ürünlerde 3 gün. */
export function openedDaysFor(item: Pick<FridgeItem, 'catalogId' | 'category'>): number | undefined {
  const cat = getCatalogItem(item.catalogId);
  if (cat) return cat.opened;
  // Pişmiş yemek "açılmaz"; süresi pişirildiği günden sayılır.
  return PERISHABLE.has(item.category) && item.category !== 'yemek' ? 3 : undefined;
}

export function canOpen(item: FridgeItem, ref: DayString = today()): boolean {
  return !item.opened && item.storage !== 'freezer' && daysLeft(item, ref) >= 0 && openedDaysFor(item) !== undefined;
}

/** Açılan taze ürün oda sıcaklığında kalmaz: tezgâh/kilerdeyse buzdolabına geçer. */
export function storageAfterOpening(item: FridgeItem): StorageId {
  return PERISHABLE.has(item.category) && (item.storage === 'pantry' || item.storage === 'counter') ? 'fridge' : item.storage;
}

/**
 * Buzdolabına almak ömrü uzatıyorsa (ör. ceviz kilerde 30, dolapta 180 gün) yeni tarih.
 * Eklendiği günden itibaren dolap süresi sayılır; mevcut tarihten kısa olamaz.
 */
export function useByIfMovedToFridge(item: FridgeItem, ref: DayString = today()): DayString | undefined {
  // Paketteki tarih tahmine bırakılmaz.
  if (item.storage === 'fridge' || item.storage === 'freezer' || daysLeft(item, ref) < 0 || item.dateSource === 'package') return undefined;
  const cat = getCatalogItem(item.catalogId);
  if (cat?.days.fridge === undefined) return undefined;
  // Dolap süresi alındığı (yoksa eklendiği) günden sayılır; açıksa açık ömrü yine uygulanır.
  const next = effectiveUseBy({ ...item, storage: 'fridge', baseUseBy: estimateBase({ ...item, storage: 'fridge' }) });
  return diffDays(next, item.useBy) > 0 ? next : undefined;
}

/** Dondurucudan buzdolabına alınınca (çözdürme) kaç gün içinde tüketilmeli. USDA "The Big Thaw". */
export function useByAfterThaw(item: FridgeItem, ref: DayString = today()): DayString {
  const fast = ['tavuk', 'kiyma', 'balik', 'karides', 'midye'];
  const base = item.category === 'et' ? (fast.includes(item.catalogId ?? '') ? 1 : item.catalogId === 'kirmizi-et' ? 3 : 2) : 3;
  // Taze hâlinden uzun olamaz (ör. bebek püresi dolapta 2 gün).
  const fresh = getCatalogItem(item.catalogId)?.days.fridge;
  return addDays(ref, fresh !== undefined ? Math.min(base, fresh) : base);
}

/** Çiğ et/balık gibi 2 gün içinde bitmesi gereken, dondurulabilir ürün: "pişirmeyeceksen dondur" önerisi. */
export function shouldSuggestFreezing(item: FridgeItem, ref: DayString = today()): boolean {
  const left = daysLeft(item, ref);
  if (!freezeWorthIt(item, ref) || left < 0) return false;
  return item.category === 'et' ? left <= 2 : left <= 1;
}

/** Dondurma önerisinin ürüne göre metni. */
export function freezeAdvice(item: FridgeItem, ref: DayString = today()): string {
  const left = daysLeft(item, ref);
  const tips: Record<string, string> = {
    ekmek: 'Yetiştiremeyeceksen dilimleyip dondur; kızartıcıda ısıtırsın.',
    muz: 'Soyup dondur; smoothie ya da kekte kullanırsın.',
    cilek: 'Yıkayıp kurula, dondur; smoothie ya da reçelde kullanırsın.',
  };
  if (item.catalogId && tips[item.catalogId]) return tips[item.catalogId]!;
  if (item.category === 'yemek') return 'Yetiştiremeyeceksen porsiyonlayıp şimdi dondur.';
  if (item.category === 'meyve') return left === 0 ? 'Bugün yemeyeceksen hemen dondur.' : 'Yemeyi düşünmüyorsan şimdiden dondur; aylarca dayanır.';
  return left === 0 ? 'Bugün pişirmeyeceksen hemen dondur.' : 'Pişirmeyi düşünmüyorsan şimdiden dondur; aylarca dayanır.';
}
