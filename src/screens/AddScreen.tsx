import { memo, startTransition, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CATALOG, CATEGORIES, CUSTOM_DAYS, PERISHABLE, PICKABLE_IMAGES, STORAGES, defaultStorage, findExact, getCatalogItem, getCategory, guessCatalog, parseAgo, queryScore, searchKey } from '../data/catalog';
import { customStorages, effectiveUseBy, isBulk, leftLabel, qualityOnly, suggestCustomUseBy, suggestUseBy } from '../lib/freshness';
import { isDay } from '../lib/validate';
import { addDays, diffDays, longDate, roughDuration, today } from '../lib/dates';
import { foodImageUrl } from '../lib/images';
import { LEVEL_LABEL, UNITS, UNIT_LABEL, defaultUnit, hasLevel, qtyText } from '../lib/units';
import { MAX_QTY, useFridge, type NewItem } from '../store/useFridge';
import { FoodTile } from '../components/Food';
import { Fridge } from '../components/Fridge';
import { DayChoice } from '../components/DayChoice';
import { Icon, type IconName } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { Segmented, Stepper, Toggle } from '../components/Stepper';
import { toast } from '../components/Toast';
import { useReducedMotion } from '../lib/useReducedMotion';
import { useToday } from '../lib/useToday';
import type { CatalogItem, CategoryId, DateSource, DayString, FridgeItem, HistoryEntry, Level, PackageKind, StorageId, Unit } from '../types';

type Draft = {
  catalog?: CatalogItem;
  name: string;
  img: string;
  /** Kullanıcı görseli kendisi seçti mi (kategori değişince korunur). */
  imgPicked: boolean;
  category: CategoryId;
  storage: StorageId;
  quantity: number;
  /** Sayıldığı birim (şişe, kutu, kap…); gram/ml sorulmaz. */
  unit: Unit;
  /** Kullanıcı birimi kendisi seçti mi (tür değişince korunur). */
  unitPicked: boolean;
  opened: boolean;
  /** Paketin açıldığı gün; boşsa bugün. */
  openedAt?: DayString;
  /** Açık paketin yaklaşık doluluğu (isteğe bağlı). */
  level?: Level;
  /** Taze üründe alındığı gün (isteğe bağlı); boşsa bugün sayılır. */
  boughtAt?: DayString;
  /** Pişmiş yemekte kaç gün önce pişti; dondurucu/uzun kiler ürününde kabaca kaç gün önce donduruldu/alındı. */
  ago: number;
  dateSource: DateSource;
  /** Paketteki ya da elle seçilen gün (dateSource 'package' | 'manual'). */
  fixedUseBy?: DayString;
  /** Paketteki tarihin türü; kullanıcı seçer, kategoriden varsayılmaz. */
  packageKind: PackageKind;
  /** Ad kullanıcının yazdığı (katalogla eşleşse de değiştirilebilir). */
  nameEditable: boolean;
  /** Adından tahmin edildi (kullanıcı "Bu değil" diyebilir). */
  guessed?: boolean;
  /** Türü tahmin edilemedi: kullanıcıdan seçmesi istenir. */
  unsure?: boolean;
};

type DraftInit = Pick<Draft, 'name' | 'img' | 'category' | 'storage'> & Partial<Draft>;

/** Taslağı varsayılanlarla kurar. Taze üründe "dünkü …" alınma günü olur; pişmiş yemekte pişirilme. */
function initDraft(init: DraftInit, ref: DayString): Draft {
  const d: Draft = {
    imgPicked: false,
    quantity: 1,
    opened: false,
    ago: 0,
    dateSource: 'auto',
    packageKind: 'unknown',
    nameEditable: true,
    unitPicked: false,
    unit: defaultUnit({ catalogId: init.catalog?.id, category: init.category }),
    ...init,
    // "Açılmış konserve" zaten açıktır: açılma günü sorulur, alınma günü sorulmaz.
    ...(init.catalog?.id === 'konserve' ? { opened: true } : {}),
  };
  if (d.ago && d.category !== 'yemek' && askBought(d)) return { ...d, boughtAt: addDays(ref, -d.ago), ago: 0 };
  return d;
}

/** Aylarca dayanan kiler ürünü: ne zaman alındığı kabaca sorulur (geçen yılın bulguru bugünden 1 yıl almasın). */
function isLongPantry(d: Pick<Draft, 'storage' | 'category' | 'catalog'>): boolean {
  if (d.storage !== 'pantry' || d.category === 'yemek') return false;
  return d.catalog ? (d.catalog.days.pantry ?? 0) > 60 : (CUSTOM_DAYS[d.category].pantry ?? 0) > 60;
}

/** Taze ürün (pişmiş yemek değil): "Ne zaman aldın?" sorulabilir. */
function askBought(d: Pick<Draft, 'storage' | 'category' | 'catalog'>): boolean {
  return PERISHABLE.has(d.category) && d.category !== 'yemek' && d.storage !== 'freezer' && d.catalog?.stable !== true && d.catalog?.id !== 'konserve' && !isLongPantry(d);
}

const laterDay = (a: DayString, b: DayString) => (diffDays(a, b) >= 0 ? a : b);

/**
 * Taslağın tarihleri. Alma, açma ve pişirme günleri ayrı tutulur; uygulamaya eklenme günü her zaman bugündür.
 * - base: kapalıyken geçerli sınır (paketteki tarih, elle seçilen ya da alındığı/piştiği günden tahmin).
 * - openedUseBy: açılan paketin son günü = base ile "açıldığı gün + açık ömrü"nden erken olanı.
 */
function draftDates(d: Draft, ref: DayString) {
  const c = d.catalog;
  const cooked = d.category === 'yemek';
  const rough = d.storage === 'freezer' || isLongPantry(d);
  const cookedAt = cooked ? addDays(ref, -d.ago) : undefined;
  const boughtAt = cooked ? undefined : isLongPantry(d) ? (d.ago ? addDays(ref, -d.ago) : undefined) : askBought(d) ? d.boughtAt : undefined;
  const from = cooked || rough ? addDays(ref, -d.ago) : (boughtAt ?? ref);
  const estimate = c ? suggestUseBy(c, d.storage, false, from) : suggestCustomUseBy(d.category, d.storage, from);
  const base = d.dateSource === 'auto' || !d.fixedUseBy ? estimate : d.fixedUseBy;
  const openedAt = boughtAt ? laterDay(d.openedAt ?? ref, boughtAt) : (d.openedAt ?? ref);
  const openedUseBy = d.dateSource === 'manual' ? base : effectiveUseBy({ useBy: base, baseUseBy: base, category: d.category, storage: d.storage, opened: true, openedAt, catalogId: c?.id });
  return { base, openedUseBy, useBy: d.opened ? openedUseBy : base, boughtAt, cookedAt, openedAt };
}

/** Undefined alanları atar (kayıtta boş anahtar kalmasın). */
const compact = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** "Bugün", "Dün", "3 gün önce". */
const agoText = (day: DayString | undefined, ref: DayString) => {
  const n = day ? diffDays(ref, day) : 0;
  return n <= 0 ? 'Bugün' : n === 1 ? 'Dün' : `${n} gün önce`;
};

/** "Sık aldıkların" satırındaki bir ürün (katalogdan ya da senin eklediğin özel ürün). */
type Recent = { key: string; name: string; img: string; category: CategoryId; catalogId?: string; storage: StorageId; days: number; unit: Unit; clean?: boolean };

/**
 * Geçmiş ve mutfaktakilerden en sık eklenen 8 ürün. Ekran açıkken sabit kalır (dokunurken kaymasın).
 * Süre, ürünün eklendiği andaki hâlinden gelir: dondurulmuş/çözülmüş, açılmış ya da elle tarihi düzeltilmiş
 * kayıtlardan süre devralınmaz (çözülmüş püre yeniden eklenince 23 gün almasın).
 */
function buildRecents(items: FridgeItem[], history: HistoryEntry[]): Recent[] {
  const map = new Map<string, Recent & { n: number; last: number }>();
  // Mutfaktakiler en yeni; geçmiş yeni → eski sırada.
  const all = [...items.map((i, idx) => ({ i, t: 1_000_000 + idx })), ...history.map((h, idx) => ({ i: h.item, t: -idx }))];
  for (const { i, t } of all) {
    if (!i) continue;
    const c = getCatalogItem(i.catalogId);
    const isCatalog = !!c && c.name === i.name;
    const key = isCatalog ? c!.id : `ozel:${searchKey(i.name)}`;
    const prev = map.get(key);
    const clean = !i.thawed && !i.opened && i.dateSource === 'auto' && i.storage !== 'freezer';
    let storage: StorageId;
    let days: number;
    if (c) {
      storage = defaultStorage(c);
      days = diffDays(suggestUseBy(c, storage, false, today()), today());
    } else {
      storage = clean ? i.storage : (customStorages(i.category)[0] ?? 'fridge');
      days = clean ? Math.max(1, diffDays(i.useBy, i.addedAt)) : diffDays(suggestCustomUseBy(i.category, storage, today()), today());
    }
    // En yeni temiz kayıt kazanır.
    const keepPrev = prev && (prev.last > t || (prev.clean && !clean));
    const base = keepPrev ? prev! : { key, name: i.name, img: i.img, category: i.category, catalogId: i.catalogId, storage, days, unit: i.unit ?? defaultUnit(i), clean, last: t };
    map.set(key, { ...base, n: (prev?.n ?? 0) + 1, last: Math.max(prev?.last ?? -Infinity, t) });
  }
  return [...map.values()].sort((a, b) => b.n - a.n || b.last - a.last).slice(0, 8);
}

type Phase = 'closed' | 'open' | 'leaving' | 'ready';

/** Kapak animasyonunun tamamı oturumda yalnızca ilk açılışta oynar; sonrakiler kısa. */
let introSeen = false;

const STORAGE_DATIVE: Record<StorageId, string> = { fridge: 'buzdolabına', freezer: 'dondurucuya', counter: 'tezgâha', pantry: 'kilere' };
const STORAGE_LOCATIVE: Record<StorageId, string> = { fridge: 'Buzdolabında', freezer: 'Dondurucuda', counter: 'Tezgâhta', pantry: 'Kilerde / mutfak dolabında' };
const STORAGE_ICON: Record<StorageId, IconName> = { fridge: 'fridge', freezer: 'snow', counter: 'leaf', pantry: 'box' };
const SUBMIT_LABEL: Record<StorageId, string> = { fridge: 'Buzdolabına ekle', freezer: 'Dondurucuya ekle', counter: 'Tezgâha ekle', pantry: 'Kilere ekle' };
const FLY_MS = 520;
/** Katalogda karşılığı olmayan ek görsellerin adları (ekran okuyucu için). */
const IMAGE_NAMES: Record<string, string> = {
  '🍣': 'Suşi', '🍤': 'Karides', '🍜': 'Erişte çorbası', '🍛': 'Köri', '🌮': 'Tako', '🍖': 'Kemikli et', '🥞': 'Pankek', '🧇': 'Waffle',
  '🧁': 'Kek', '🍩': 'Donut', '🍪': 'Kurabiye', '🍫': 'Çikolata', '🥜': 'Fıstık', '🫕': 'Fondü', '🍢': 'Şiş', '🥠': 'Şans kurabiyesi',
  '🍦': 'Külah dondurma', '🧋': 'Baloncuklu çay', '🍵': 'Yeşil çay', '🍺': 'Bira', '🍷': 'Şarap', '🥤': 'Soğuk içecek', '🍳': 'Sahanda yumurta', '🧉': 'Mate',
};
/** Görsel seçicide ekran okuyucu için ad: o görseli kullanan ilk ürün. */
const imageLabel = (img: string) => CATALOG.find((c) => c.img === img)?.name ?? CATEGORIES.find((k) => k.img === img)?.name ?? IMAGE_NAMES[img] ?? 'Görsel';
/** Özel ürünün varsayılan görseli: yoğurtlu süt ürünü/yemek (bebek yoğurdu, yoğurtlu meze) kase, diğerleri kategorinin görseli. */
const defaultImg = (name: string, category: CategoryId) => ((category === 'sut' || category === 'yemek') && /\byogur[td]/.test(searchKey(name)) ? '🥣' : getCategory(category).img);
/** Birden çok hızlı ekleme: "Süt, Ekmek +1 eklendi" ya da "Yumurta: 3 adet eklendi". */
function sessionText(list: QuickEntry[]): string {
  const names = [...new Set(list.map((e) => e.name))];
  if (names.length === 1) return `${names[0]}: ${qtyText(list.reduce((n, e) => n + e.added, 0), list[0]!.unit)} eklendi`;
  const more = names.length - 2;
  return `${names.slice(0, 2).join(', ')}${more > 0 ? ` +${more}` : ''} eklendi`;
}
const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('tr') + s.slice(1);
/** Bildirimde "28 gün / kaldı" diye bölünmesin. */
const nbsp = (s: string) => s.replace(/ (gün|kaldı|geçti|son)/g, '\u00a0$1');
/** İlk açılışta kapak animasyonu sırasında yalnızca bu kadar kategori çizilir; kalanı boşta parça parça. */
const FIRST_GROUPS = 1;
const GROUPS_PER_CHUNK = 2;

/** Bu ekranda tek dokunuşla yapılan bir ekleme (oturum boyu "Geri al" için). */
type QuickEntry = { id: string; merged: boolean; prevQuantity: number; added: number; key: string; name: string; unit: Unit };

/**
 * Yazılandan ürün tahmini. "dünkü makarna" / "makarna haşladım" pişmiş yemektir (kuru makarna değil): tahmin yazılanın
 * tamamından yapılır. Yalnızca "dünkü süt/ekmek/tavuk" gibi taze bir ürün bulunursa zaman sözcüğü atılmış ad kullanılır
 * (dün alınmış süt; süre alındığı günden sayılır).
 */
function guessTyped(raw: string) {
  const { ago, name: cleaned } = parseAgo(raw.trim());
  const whole = guessCatalog(raw.trim());
  if (!ago) return whole;
  const clean = guessCatalog(cleaned);
  const freshItem = clean?.item && clean.item.category !== 'yemek' && PERISHABLE.has(clean.item.category);
  // "dünkü çorba": bütün metin yalnızca "yemek" der; temizlenmiş ad katalogdaki Çorba'yı bulursa o kullanılır.
  return freshItem || !whole || (!whole.item && clean?.item) ? clean : whole;
}

/** Alışveriş listesinden "Mutfağa ekle": ürün katalogdaysa form doğrudan açılır, değilse arama bu adla başlar. */
export interface AddPreset {
  name: string;
  /** Listeden gelindiyse o satır: ürün eklenince listeden kalkar. */
  shoppingId?: string;
  catalogId?: string;
  quantity?: number;
  unit?: Unit;
}

export function AddScreen({ onClose, preset }: { onClose: () => void; preset?: AddPreset }) {
  const initialQuery = preset?.name;
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduced ? 'ready' : 'closed');
  const presetUsed = useRef(false);
  const committed = useRef<unknown>(null);
  const [closing, setClosing] = useState(false);
  const [query, setQuery] = useState(() => (initialQuery ?? '').slice(0, 60));
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [pulse, setPulse] = useState(0);
  const fridgeRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastTile = useRef<DOMRect | null>(null);
  const items = useFridge((s) => s.items);
  const add = useFridge((s) => s.add);
  /** Bu açılışta tek dokunuşla eklenenler; bildirimdeki "Geri al" hepsini geri alır. */
  const session = useRef<QuickEntry[]>([]);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const [hintH, setHintH] = useState<number>();

  // Açılış: kapak açılır, içi görünür, sonra dolabın içine "dalıp" katalog belirir.
  // Aşamalar birbirini zincirleme izler: yavaş telefonda bile "dalış" kesinlikle bir kez çizilir.
  const [full] = useState(() => {
    const f = !introSeen;
    introSeen = true;
    return f;
  });
  const [catalogOn, setCatalogOn] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    if (phase === 'closed') raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => setPhase('open'))));
    if (phase === 'open') {
      // Katalog, kapak dönmeye başladıktan sonra ve acele etmeden hazırlanır.
      const c = setTimeout(() => startTransition(() => setCatalogOn(true)), 140);
      t = setTimeout(() => setPhase('leaving'), full ? 600 : 380);
      return () => {
        clearTimeout(c);
        clearTimeout(t);
      };
    }
    if (phase === 'leaving') {
      setCatalogOn(true);
      t = setTimeout(() => setPhase('ready'), 320);
    }
    if (phase === 'ready' && preset?.catalogId && !presetUsed.current) {
      presetUsed.current = true;
      const c = getCatalogItem(preset.catalogId);
      // Listedeki ad korunur ("Bebek yoğurdu" Yoğurt'a bağlı ama kendi adıyla).
      if (c) startDraft(c, null, { name: preset.name, ago: 0 });
    }
    return () => {
      cancelAnimationFrame(raf);
      if (t) clearTimeout(t);
    };
  }, [phase, reduced, full]);

  // Açılışta yalnızca "Sık aldıkların" ve ilk kategori çizilir (yavaş telefonda kapak takılmasın);
  // kalan kategoriler animasyon bittikten sonra, tarayıcı boştayken birkaç grup birkaç grup eklenir.
  const [groupsShown, setGroupsShown] = useState(FIRST_GROUPS);
  useEffect(() => {
    if (phase !== 'ready' || groupsShown >= CATEGORIES.length) return;
    const step = () => startTransition(() => setGroupsShown((n) => Math.min(CATEGORIES.length, n + GROUPS_PER_CHUNK)));
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(step, { timeout: 250 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(step, 30);
    return () => clearTimeout(t);
  }, [phase, groupsShown]);
  const allGroups = groupsShown >= CATEGORIES.length;

  const skipIntro = () => {
    setPhase('leaving');
    setTimeout(() => setPhase('ready'), reduced ? 0 : 300);
  };

  useEffect(() => {
    if (phase === 'ready') panelRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const close = () => {
    if (closing) return;
    if (reduced) return onClose();
    setClosing(true);
    setTimeout(onClose, 220);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.body.classList.contains('has-sheet') && close();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('is-adding');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('is-adding');
    };
  });

  // Raflarda yalnızca buzdolabındakiler görünür (muz gibi tezgâh ürünleri değil).
  const fridgeImgs = useMemo(() => [...new Set([...items].reverse().filter((i) => i.storage === 'fridge').map((i) => i.img))], [items]);
  const shelfImages = useMemo(() => {
    const imgs = fridgeImgs;
    const fallback = ['🥛', '🧀', '🍅', '🥚', '🥕', '🍋', '🍓', '🥬', '🧈'];
    return [...imgs, ...fallback].slice(0, 9);
  }, [fridgeImgs]);

  const q = searchKey(query.trim());
  // Arama yazılınca seçili kategori yok sayılır: "elma" her zaman bulunur.
  const results = useMemo(() => {
    if (!q) return CATALOG.filter((c) => cat === 'all' || c.category === cat);
    return CATALOG.map((c) => [c, queryScore(c, q)] as const)
      .filter(([, n]) => n > 0)
      // Eşitlikte çiğ/paketli ürün pişmişin önünde ("makarna" → kuru makarna).
      .sort((a, b) => b[1] - a[1] || Number(a[0].category === 'yemek') - Number(b[0].category === 'yemek'))
      .map(([c]) => c);
  }, [q, cat]);
  const exact = q ? findExact(query) : undefined;
  // Sonuç yoksa adından tahmin edilen ürünü göster ("mercimek çorbası" → Çorba).
  const guessItem = q && results.length === 0 ? guessTyped(query)?.item : undefined;
  // Aranan ad listede birebir varsa "… ekle" (özel ürün) satırı gösterilmez.
  const hasExact = !!q && results.some((c) => queryScore(c, q) >= 50);

  // Ekran açılırken bir kez hesaplanır: ekledikçe sıra değişip parmağın altından kaymaz.
  const [recent] = useState(() => buildRecents(useFridge.getState().items, useFridge.getState().history));
  const [touched, setTouched] = useState(false);

  const renderRecent = (r: Recent) => {
    const c = r.catalogId ? getCatalogItem(r.catalogId) : undefined;
    if (c && c.name === r.name) return renderTile(c);
    const n = addedIds.filter((x) => x === r.key).length;
    return (
      <div key={r.key} className="catalog-tile">
        <button type="button" className="catalog-tile__main" aria-label={`${r.name}, ayrıntılarla ekle`} onClick={() => startCustom(r.name)}>
          <span className="catalog-tile__space" />
          <span>{r.name}</span>
        </button>
        <span className="catalog-tile__img" aria-hidden="true">
          <FoodTile img={r.img} category={r.category} size={60} />
        </span>
        <button
          type="button"
          className={`catalog-tile__quick ${n ? 'is-added' : ''}`}
          aria-label={`${r.name}: tek dokunuşla ${qtyText(1, r.unit)} ekle`}
          onClick={(e) =>
            // "Kesilmiş karpuz", "açık yoğurt" gibi açık/kesik ürünler formdan eklenir (açılma günü, dolap, açık ömrü).
            r.catalogId !== 'konserve' && guessTyped(r.name)?.opened
              ? startCustom(r.name)
              : addAndAnimate(
              [
                {
                  catalogId: r.catalogId,
                  name: r.name,
                  img: r.img,
                  category: r.category,
                  storage: r.storage,
                  quantity: 1,
                  unit: r.unit,
                  // Açılmış konserve açıktır; pişmiş yemek bugün pişmiş sayılır.
                  opened: r.catalogId === 'konserve',
                  ...(r.catalogId === 'konserve' ? { openedAt: today() } : {}),
                  ...(r.category === 'yemek' ? { cookedAt: today() } : {}),
                  useBy: addDays(today(), r.days),
                  dateSource: 'auto',
                },
              ],
              (e.currentTarget.parentElement?.querySelector('.food-tile') as HTMLElement | null)?.getBoundingClientRect() ?? null,
              r.key,
              true,
            )
          }
        >
          <span className="catalog-tile__dot">{n ? <span className="catalog-tile__n">{n}</span> : <Icon name="plus" size={14} stroke={3} />}</span>
        </button>
      </div>
    );
  };

  // Ekleme sayısı ürün başına; yalnızca dokunulan kart yeniden çizilir (169 kart değil).
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    addedIds.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1));
    return m;
  }, [addedIds]);
  const handlers = useRef({ detail: (_c: CatalogItem, _r: DOMRect | null) => {}, quick: (_c: CatalogItem, _r: DOMRect | null) => {} });
  /**
   * Aramadan gelen ürün: "dünkü çorba" → 1 gün önce pişmiş Çorba. Bir yemeği anahtar kelimeyle bulduysan
   * ("mercimek çorbası" → Çorba) yazdığın ad (zaman sözcüğü atılarak) korunur.
   */
  const typedFor = (c: CatalogItem) => {
    if (!q) return { name: c.name, ago: 0 };
    const { ago, name: cleaned } = parseAgo(query.trim());
    const ck = searchKey(cleaned.trim());
    // Yazılan ad, ürünün kendi adı değil de bir anahtar kelimesiyse ("bebek yoğurdu" → Yoğurt) yazılan ad korunur:
    // görseli ve süresi katalogdan gelir, ama ayrı bir satır olur.
    const byKeyword = !!ck && !searchKey(c.name).includes(ck) && (c.keywords ?? []).some((w) => searchKey(w) === ck);
    // Tahminle önerilen ürün ("Buna benziyor") seçildiyse de kullanıcının yazdığı ad korunur.
    const fromGuess = !!guessItem && guessItem.id === c.id;
    const keepTyped = !!ck && ((c.category === 'yemek' && !searchKey(c.name).includes(ck)) || byKeyword || fromGuess);
    return { name: keepTyped ? capitalize(cleaned.trim()) : c.name, ago };
  };
  // "Kesilmiş karpuz", "açık yoğurt": tahmin açık/kesik dediyse kutucuk da aynı yoldan gider (açılma günü sorulur, dolaba konur).
  const openedGuess = (c: CatalogItem) => !!guessItem && guessItem.id === c.id && !!guessTyped(query)?.opened;
  handlers.current.detail = (c, r) => (openedGuess(c) ? startCustom(query) : startDraft(c, r, typedFor(c)));
  handlers.current.quick = (c, r) => (openedGuess(c) ? startCustom(query) : quickAdd(c, r, typedFor(c)));
  const [stable] = useState(() => ({
    detail: (c: CatalogItem, r: DOMRect | null) => handlers.current.detail(c, r),
    quick: (c: CatalogItem, r: DOMRect | null) => handlers.current.quick(c, r),
  }));
  const renderTile = (c: CatalogItem) => <CatalogTile key={c.id} item={c} count={counts.get(c.id) ?? 0} onDetail={stable.detail} onQuick={stable.quick} />;

  /** Alışveriş listesinden gelen ürün: ad eşleşen her taslakta listedeki miktar ve birim korunur. */
  const withPreset = (d: Draft): Draft =>
    preset && searchKey(d.name) === searchKey(preset.name) ? { ...d, quantity: Math.max(1, Math.min(99, preset.quantity ?? 1)), ...(preset.unit ? { unit: preset.unit, unitPicked: true } : {}) } : d;

  const startDraft = (c: CatalogItem, rect: DOMRect | null, typed: { name: string; ago: number } = { name: c.name, ago: 0 }) => {
    lastTile.current = rect;
    const { name, ago } = typed;
    setDraft(withPreset(initDraft({ catalog: c, name, img: c.img, category: c.category, storage: defaultStorage(c), ago, nameEditable: c.category === 'yemek' || name !== c.name }, today())));
  };

  const startCustom = (typed?: string) => {
    if (!typed && exact) return startDraft(exact, null);
    lastTile.current = null;
    // "dünkü çorba" → 1 gün önce pişmiş "Çorba".
    const { ago, name: cleaned } = parseAgo((typed ?? query).trim());
    const name = cleaned ? capitalize(cleaned) : '';
    const guess = guessTyped(typed ?? query);
    // Katalogdan bir ürüne benziyorsa ("kesilmiş kavun" → Kavun, açılmış) onun süresi ve görseli, ama senin yazdığın ad.
    if (guess?.item && guess.opened && guess.item.opened === undefined) {
      // Kesilmiş elma/portakal: katalogda açılma süresi yok; taze ürün olarak buzdolabında kısa süre.
      const c = guess.item;
      setDraft(withPreset(initDraft({ name, img: c.img, imgPicked: true, category: c.category, storage: 'fridge', opened: true, ago, guessed: false }, today())));
      return;
    }
    if (guess?.item) {
      const c = guess.item;
      const opened = !!guess.opened && c.opened !== undefined;
      let storage = defaultStorage(c);
      if (opened && (storage === 'pantry' || storage === 'counter') && c.days.fridge !== undefined) storage = 'fridge';
      setDraft(withPreset(initDraft({ catalog: c, name, img: c.img, category: c.category, storage, opened, ago, guessed: true }, today())));
      return;
    }
    const category: CategoryId = guess?.category ?? (cat === 'all' ? 'yemek' : cat);
    const storage = customStorages(category)[0] ?? 'fridge';
    setDraft(withPreset(initDraft({ name, img: defaultImg(cleaned, category), category, storage, ago, unsure: !guess && cat === 'all' }, today())));
  };

  const commit = () => {
    // Çift dokunuş: kapanan panel eski taslağı hâlâ gösterir; aynı taslak ikinci kez kaydedilmez.
    if (!draft || !draft.name.trim() || committed.current === draft) return;
    committed.current = draft;
    const d = draft;
    setDraft(null);
    setQuery('');
    const dates = draftDates(d, today());
    const common = compact({
      catalogId: d.catalog?.id,
      name: d.name.trim(),
      img: d.img,
      category: d.category,
      storage: d.storage,
      unit: d.unit,
      dateSource: d.dateSource,
      packageKind: d.dateSource === 'package' ? d.packageKind : undefined,
      baseUseBy: dates.base,
      boughtAt: dates.boughtAt,
      cookedAt: dates.cookedAt,
    });
    const rows: NewItem[] = [];
    // Açıldıysa yalnızca 1 paket açıktır: kalanlar kapalı, ayrı satır.
    if (!d.opened || d.quantity > 1) rows.push({ ...common, quantity: d.opened ? d.quantity - 1 : d.quantity, opened: false, useBy: dates.base });
    if (d.opened) rows.push(compact({ ...common, quantity: 1, opened: true, openedAt: dates.openedAt, level: hasLevel(d.unit) ? d.level : undefined, useBy: dates.openedUseBy }));
    // Alışveriş listesinden gelen ürün mutfağa eklenince o satır listeden kalkar (aynı alışveriş iki kez eklenmesin); geri al onu da geri getirir.
    let restoreRow: (() => void) | undefined;
    const sid = preset?.shoppingId;
    const row = sid ? useFridge.getState().shopping.find((x) => x.id === sid) : undefined;
    if (row && searchKey(preset!.name) === searchKey(d.name) && (!preset?.catalogId || preset.catalogId === d.catalog?.id)) {
      const idx = useFridge.getState().shopping.indexOf(row);
      useFridge.getState().removeShopping(row.id);
      restoreRow = () => useFridge.setState((s) => (s.shopping.some((x) => x.id === row.id) ? s : { shopping: [...s.shopping.slice(0, idx), row, ...s.shopping.slice(idx)] }));
    }
    addAndAnimate(rows, lastTile.current, undefined, false, restoreRow);
  };

  /** Tek dokunuşla ekle: varsayılan yer ve birim, 1 tane, ortalama süre ("dünkü çorba" ise dün pişmiş). */
  const quickAdd = (c: CatalogItem, from: DOMRect | null, typed: { name: string; ago: number } = { name: c.name, ago: 0 }) => {
    const d = initDraft({ catalog: c, name: typed.name, img: c.img, category: c.category, storage: defaultStorage(c), ago: typed.ago }, today());
    const dates = draftDates(d, today());
    addAndAnimate(
      // Açık doğan ürün (açılmış konserve) açık eklenir; süresi açılış gününden.
      [compact({ catalogId: c.id, name: typed.name, img: c.img, category: c.category, storage: d.storage, quantity: 1, unit: d.unit, opened: d.opened, openedAt: d.opened ? dates.openedAt : undefined, useBy: d.opened ? dates.openedUseBy : dates.base, baseUseBy: dates.base, boughtAt: dates.boughtAt, cookedAt: dates.cookedAt, dateSource: 'auto' as const })],
      from,
      undefined,
      true,
    );
  };

  /** Eklemeleri sondan başa geri al: birleşen satır önceki miktarına döner, yeni satır silinir. */
  const revert = (entries: QuickEntry[]) => {
    const s = useFridge.getState();
    // Yalnızca o eklemenin miktarı düşülür: arada formdan aynı satıra eklenenler silinmez.
    for (const e of [...entries].reverse()) {
      const cur = useFridge.getState().items.find((i) => i.id === e.id);
      if (!cur) continue;
      const rest = cur.quantity - e.added;
      if (rest > 0) s.update(e.id, { quantity: rest });
      else s.remove(e.id);
    }
    setAddedIds((a) => {
      const next = [...a];
      for (const e of entries) {
        const i = next.lastIndexOf(e.key);
        if (i >= 0) next.splice(i, 1);
      }
      return next;
    });
  };

  /** Ürün(ler)i ekler, görseli dolaba uçurur, bildirim gösterir. Açılan paket ayrı satır olduğundan birden çok satır gelebilir. */
  const addAndAnimate = (inputs: NewItem[], from: DOMRect | null, recentKey?: string, quick = false, extraUndo?: () => void) => {
    const first = inputs[0];
    if (!first) return;
    if (!touched) setHintH(hintRef.current?.offsetHeight);
    const results = inputs.map((input) => ({ input, ...add(input) }));
    setTouched(true);
    const unit = first.unit ?? defaultUnit(first);
    const done = results.filter((r) => r.item.quantity - r.prevQuantity > 0);
    if (done.length === 0) {
      const r = results[0]!;
      toast({ text: `${r.item.name}: en fazla ${qtyText(MAX_QTY, unit)} tutabiliriz; zaten ${qtyText(r.item.quantity, unit)} var.`, top: false });
      return;
    }
    const key = recentKey ?? first.catalogId ?? done[0]!.item.id;
    const where = STORAGE_DATIVE[first.storage];
    const img = done[0]!.item.img;
    // Hedefi, ekran yeniden çizildikten sonra ölç.
    requestAnimationFrame(() => {
      setTimeout(() => setPulse((p) => p + 1), reduced ? 0 : 250);
      void flyToFridge(img, from, fridgeRef.current, reduced);
      // Rozet, ürün dolaba girdiği anda artar.
      setTimeout(() => setAddedIds((a) => [...a, key]), reduced ? 0 : FLY_MS * 0.85);
    });
    // Rozet sayacı ekleme başına bir kez artar; geri alınırken de bir kez düşer.
    const entries: QuickEntry[] = done.map((r, i) => ({ id: r.item.id, merged: r.merged, prevQuantity: r.prevQuantity, added: r.item.quantity - r.prevQuantity, key: i === 0 ? key : '', name: r.item.name, unit }));
    const name = done[0]!.item.name;
    const openedRow = done.find((r) => r.item.opened && r.input.opened);
    const closedRow = done.find((r) => !r.input.opened);
    let single: string;
    if (openedRow && closedRow) single = `${name} ${where} eklendi: ${qtyText(openedRow.item.quantity - openedRow.prevQuantity, unit)} açık, ${qtyText(closedRow.item.quantity - closedRow.prevQuantity, unit)} kapalı`;
    else {
      const r = done[0]!;
      const added = r.item.quantity - r.prevQuantity;
      const asked = r.input.quantity;
      const capped = added < asked ? ` En fazla ${qtyText(MAX_QTY, unit)} tutulabildiği için ${qtyText(asked - added, unit)} eklenmedi.` : '';
      single = r.merged ? `${name}: ${qtyText(added, unit)} daha eklendi (toplam ${qtyText(r.item.quantity, unit)}).${capped}` : `${name}: ${qtyText(added, unit)} ${where} eklendi · ${nbsp(leftLabel(r.item).toLocaleLowerCase('tr'))}`;
    }
    if (!quick) {
      // Panel kapanıyor: bildirim altta çıkar, başlıktaki "Tamam"ı örtmez.
      toast({
        text: single,
        tone: 'good',
        undo: () => {
          revert(entries);
          extraUndo?.();
        },
        top: false,
      });
      return;
    }
    // Tek dokunuşla eklenenler birikir: bildirim, bu açılıştaki tüm hızlı eklemeleri birlikte geri alır.
    session.current = [...session.current, ...entries];
    const list = session.current;
    toast({
      text: list.length === 1 ? single : sessionText(list),
      tone: 'good',
      top: false,
      undo: () => {
        revert(list);
        session.current = session.current.filter((e) => !list.includes(e));
      },
    });
  };

  const count = new Set(addedIds).size;

  // Gece yarısı geçerse taslak yeni güne göre hesaplanır: "bugün açıldı/alındı" yeni bugüne kayar, seçilmiş günler sabit kalır.
  const day = useToday();
  // Pişirilme günü (ve kiler/dondurucu "ne zaman" seçimi) gün olarak sabittir: gece yarısı geçince "kaç gün önce" bir artar (fazladan gün verilmez).
  const prevDay = useRef(day);
  useEffect(() => {
    const diff = diffDays(day, prevDay.current);
    prevDay.current = day;
    if (diff > 0) setDraft((d) => (d && (d.category === 'yemek' || d.storage === 'freezer' || isLongPantry(d)) ? { ...d, ago: d.ago + diff } : d));
  }, [day]);

  return (
    <div className={`add add--${phase} ${closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-label="Ürün ekle">
      {phase !== 'ready' && (
        <button type="button" className="add-intro" onClick={skipIntro} aria-label="Animasyonu geç">
          <Fridge open={phase === 'open' || phase === 'leaving'} items={shelfImages} width={176} />
          <p className="add-intro__text">Dokun, hemen başla</p>
        </button>
      )}

      <div className="add__panel" aria-hidden={phase === 'closed' || phase === 'open'} ref={panelRef} tabIndex={-1}>
        <header className="add__head">
          <button type="button" className="icon-btn" onClick={close} aria-label="Kapat">
            <Icon name="back" size={22} />
          </button>
          <div className="add__title">
            <h1>Ne ekledin?</h1>
            <p>{count ? `${count} ürün eklendi` : 'Süreyi biz hesaplarız'}</p>
          </div>
          <div className="add__mini" ref={fridgeRef} aria-hidden="true">
            <Fridge open={false} width={26} pulse={pulse || undefined} />
            {count > 0 && (
              <span className="add__badge" key={count}>
                {count}
              </span>
            )}
          </div>
          {/* Yeri baştan ayrılır; ilk eklemede başlık kaymaz. */}
          <button type="button" className={`add__done ${count ? 'is-visible' : ''}`} onClick={close} tabIndex={count ? 0 : -1} aria-hidden={!count}>
            Tamam
          </button>
        </header>

        <label className="search">
          <Icon name="search" size={20} />
          <input
            type="search"
            aria-label="Ürün ara"
            placeholder="Ürün ara: süt, ıspanak, köfte…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
            maxLength={60}
          />
          {query && (
            <button type="button" className="search__clear" onClick={() => setQuery('')} aria-label="Aramayı temizle">
              <Icon name="x" size={16} />
            </button>
          )}
        </label>

        {!q && (
          <div className="cat-chips" role="group" aria-label="Kategori">
            <button type="button" aria-pressed={cat === 'all'} className={`cat-chip ${cat === 'all' ? 'is-active' : ''}`} onClick={() => setCat('all')}>
              Tümü
            </button>
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" aria-pressed={cat === c.id} className={`cat-chip ${cat === c.id ? 'is-active' : ''}`} onClick={() => setCat(c.id)}>
                <img src={foodImageUrl(c.img)} alt="" width={20} height={20} />
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="add__scroll">
          {/* Katalog, kapak açıkken (panel gizliyken) hazırlanır; dalış anında takılma olmaz. */}
          {!catalogOn ? null : (
            <>
          {!q && cat === 'all' && recent.length > 0 && (
            <section className="catalog-group catalog-group--recent">
              <h2 className="catalog-group__title">Sık aldıkların</h2>
              <div className="catalog-grid">{recent.map(renderRecent)}</div>
            </section>
          )}
          {/* İlk eklemede kutu aynı boyda kalır, yalnızca yazısı değişir: kartlar parmağın altından kaymaz. */}
          {!q && (
            <p ref={hintRef} className={`add__hint ${touched ? 'add__hint--done' : ''}`} style={touched && hintH ? { minHeight: hintH } : undefined}>
              {touched && count > 0 ? (
                <span>
                  {count} ürün eklendi · bitince <b>Tamam</b>’a dokun
                </span>
              ) : (
                <>
                  İpucu: Köşedeki <b>+</b> ile tek dokunuşta ekle; ürüne dokunursan miktar, yer ve tarihi ayarlarsın.
                </>
              )}
            </p>
          )}
          {/* Arama ve tek kategori her zaman tüm veriden çizilir; yalnızca "Tümü" görünümü parça parça. */}
          {(cat === 'all' && !q ? CATEGORIES.slice(0, groupsShown) : [null]).map((group) => {
            const list = group ? results.filter((r) => r.category === group.id) : results;
            if (list.length === 0) return null;
            return (
              <section key={group?.id ?? 'results'} className="catalog-group">
                {group && <h2 className="catalog-group__title">{group.name}</h2>}
                <div className="catalog-grid">
                  {list.map(renderTile)}
                </div>
              </section>
            );
          })}
          {results.length === 0 && guessItem && (
            <section className="catalog-group">
              <h2 className="catalog-group__title">Buna benziyor</h2>
              <div className="catalog-grid">{renderTile(guessItem)}</div>
            </section>
          )}
          {results.length === 0 && !guessItem && <p className="no-results">“{query.trim()}” listede yok. Aşağıdan kendin ekleyebilirsin; süresini türüne göre tahmin ederiz.</p>}
          {!hasExact && (allGroups || !!q || cat !== 'all') && (
            <button type="button" className="custom-add" onClick={() => startCustom()}>
              <span className="custom-add__icon">
                <Icon name="plus" size={20} stroke={2.5} />
              </span>
              <span>
                <strong>{query.trim() ? `“${query.trim()}” ekle` : 'Listede yok mu?'}</strong>
                <small>Adını yaz, süresini biz tahmin edelim</small>
              </span>
            </button>
          )}
            </>
          )}
        </div>
      </div>

      <Sheet open={!!draft} onClose={() => setDraft(null)} label="Ürün ayrıntıları">
        {draft && <DraftForm draft={draft} setDraft={setDraft} onSubmit={commit} day={day} />}
      </Sheet>
    </div>
  );
}

/** Katalog kartı: ürüne dokun = ayrıntılı ekle, köşedeki + = tek dokunuşta ekle. */
const CatalogTile = memo(function CatalogTile({
  item: c,
  count: n,
  onDetail,
  onQuick,
}: {
  item: CatalogItem;
  count: number;
  onDetail: (c: CatalogItem, r: DOMRect | null) => void;
  onQuick: (c: CatalogItem, r: DOMRect | null) => void;
}) {
  const rect = (el: HTMLElement) => (el.parentElement?.querySelector('.food-tile') as HTMLElement | null)?.getBoundingClientRect() ?? null;
  // Görsel dokunmayı geçirir; ayrıntı düğmesi köşedeki + alanını kapsamaz (iki hedef üst üste binmez).
  return (
    <div className="catalog-tile">
      <button type="button" className="catalog-tile__main" aria-label={n ? `${c.name}, eklendi. Ayrıntılarla ekle` : `${c.name}, ayrıntılarla ekle`} onClick={(e) => onDetail(c, rect(e.currentTarget))}>
        <span className="catalog-tile__space" />
        <span>{c.name}</span>
      </button>
      <span className="catalog-tile__img" aria-hidden="true">
        <FoodTile img={c.img} category={c.category} size={60} />
      </span>
      <button type="button" className={`catalog-tile__quick ${n ? 'is-added' : ''}`} aria-label={`${c.name}: tek dokunuşla ${qtyText(1, defaultUnit({ catalogId: c.id, category: c.category }))} ekle`} onClick={(e) => onQuick(c, rect(e.currentTarget))}>
        <span className="catalog-tile__dot">{n ? <span className="catalog-tile__n">{n}</span> : <Icon name="plus" size={14} stroke={3} />}</span>
      </button>
    </div>
  );
});

const PACKAGE_KINDS: { id: PackageKind; label: string }[] = [
  { id: 'stt', label: 'Son tüketim tarihi (STT)' },
  { id: 'tett', label: 'Tavsiye edilen tüketim tarihi (TETT)' },
  { id: 'unknown', label: 'Bilmiyorum' },
];
const PACKAGE_NOTE: Record<PackageKind, string> = {
  stt: 'STT geçtikten sonra tüketilmemeli.',
  tett: 'TETT bir kalite tarihidir; geçince kokusuna ve görünüşüne bak.',
  unknown: 'Paketin üstünde “Son tüketim” mi “Tavsiye edilen” mi yazıyor, bakabilirsin. Seçmesen de olur.',
};

/** Klavye açıkken (visualViewport küçülünce) paneli klavyenin üstüne taşır; odaklanan alanı görünür tutar. */
function useKeyboardInset(form: RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    const vv = window.visualViewport;
    const sheet = form.current?.closest<HTMLElement>('.sheet');
    if (!vv || !sheet) return;
    const update = () => {
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      sheet.style.setProperty('--kb', `${kb > 80 ? kb : 0}px`);
      sheet.classList.toggle('has-kb', kb > 80);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      sheet.style.removeProperty('--kb');
      sheet.classList.remove('has-kb');
    };
  }, [form]);
}

function DraftForm({ draft, setDraft, onSubmit, day }: { draft: Draft; setDraft: (d: Draft) => void; onSubmit: () => void; day: DayString }) {
  const c = draft.catalog;
  const [pickImage, setPickImage] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [boughtOpen, setBoughtOpen] = useState(!!draft.boughtAt);
  const formRef = useRef<HTMLFormElement>(null);
  useKeyboardInset(formRef);
  const ref = day;
  const dates = draftDates(draft, ref);
  const left = diffDays(dates.useBy, ref);
  const allowed = STORAGES.filter((s) => (c ? c.days[s.id] !== undefined : customStorages(draft.category).includes(s.id)));
  // Açılmış/kesilmiş taze ürün ve açılmış konserve/kutu (TETT) oda sıcaklığında bekletilmez (kuru gıdalar hariç).
  const roomUnsafe = (id: StorageId, opened: boolean, category: CategoryId) => opened && (PERISHABLE.has(category) || !!c?.tett) && (id === 'pantry' || id === 'counter');
  const storages = allowed.map((s) => ({ id: s.id, label: s.name, disabled: roomUnsafe(s.id, draft.opened, draft.category) }));
  const openedDays = c ? c.opened : PERISHABLE.has(draft.category) ? 3 : undefined;
  const isCooked = draft.category === 'yemek';
  const stableItem = c?.stable === true;
  const longPantry = isLongPantry(draft);
  const unitName = UNIT_LABEL[draft.unit];
  const qtyLabel = `Kaç ${unitName}?`;
  const showOpened = openedDays !== undefined && draft.storage !== 'freezer' && !isCooked;
  const opened = showOpened && draft.opened;
  const qtyChips = isCooked || isBulk(draft) || stableItem || draft.category === 'donuk' ? [] : draft.unit === 'adet' ? [2, 6, 10, 12, 30] : [2, 3, 4, 6];
  const pastStt = draft.dateSource === 'package' && draft.packageKind === 'stt' && diffDays(dates.base, ref) < 0;

  /** Değişiklik sonrası yer ve birim tutarlı kalsın; tarihler her çizimde taslaktan hesaplanır. */
  const apply = (patch: Partial<Draft>): Draft => {
    const next = { ...draft, ...patch };
    // Özel üründe kategori değişince, yeni kategoriye uymayan saklama yeri sıfırlanır.
    if (!next.catalog && !customStorages(next.category).includes(next.storage)) next.storage = customStorages(next.category)[0] ?? 'fridge';
    const nextAllowed = next.catalog ? STORAGES.filter((s) => next.catalog!.days[s.id] !== undefined).map((x) => x.id) : customStorages(next.category);
    if (roomUnsafe(next.storage, next.opened, next.category) && nextAllowed.includes('fridge')) next.storage = 'fridge';
    if (!next.unitPicked) next.unit = defaultUnit({ catalogId: next.catalog?.id, category: next.category });
    return next;
  };

  const setLeft = (n: number) => setDraft({ ...draft, fixedUseBy: addDays(ref, Math.max(0, n)), packageKind: 'unknown', dateSource: 'manual' });

  return (
    <form
      ref={formRef}
      className="draft"
      onSubmit={(e) => {
        e.preventDefault();
        if (pastStt) return;
        onSubmit();
      }}
      onFocus={(e) => {
        // Klavye açılınca yazılan alan ve "Ekle" düğmesi görünür kalsın.
        const t = e.target;
        if (!(t instanceof HTMLInputElement) || ['button', 'checkbox', 'radio'].includes(t.type)) return;
        setTimeout(() => t.isConnected && t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320);
      }}
    >
      <div className="draft__head">
        {c ? (
          <FoodTile img={draft.img} category={draft.category} size={72} />
        ) : (
          <button type="button" className="draft__img-btn" onClick={() => setPickImage((v) => !v)} aria-label="Görsel seç" aria-expanded={pickImage}>
            <FoodTile img={draft.img} category={draft.category} size={72} />
            <span className="draft__img-edit">
              <Icon name="edit" size={12} />
            </span>
          </button>
        )}
        <div className="draft__head-text">
          {!draft.nameEditable ? (
            <h2 className="draft__name">{draft.name}</h2>
          ) : (
            <input
              className="draft__name-input"
              placeholder="Ürün adı"
              value={draft.name}
              autoFocus={!draft.name}
              maxLength={60}
              enterKeyHint="done"
              onChange={(e) => setDraft({ ...draft, name: e.target.value, img: c || draft.imgPicked ? draft.img : defaultImg(e.target.value, draft.category) })}
              aria-label="Ürün adı"
            />
          )}
          <p className="draft__cat">{c && draft.nameEditable && searchKey(draft.name) !== searchKey(c.name) ? `${c.name} gibi saklanır` : getCategory(draft.category).name}</p>
          {draft.guessed && c && (
            <button
              type="button"
              className="link-btn link-btn--small"
              onClick={() => {
                // Tahmin yanlışsa kataloğa bağlamadan, türünü kullanıcı seçsin.
                const storage = customStorages(c.category)[0] ?? 'fridge';
                setDraft(apply({ catalog: undefined, guessed: false, unsure: true, img: defaultImg(draft.name, c.category), storage, opened: false, dateSource: 'auto', fixedUseBy: undefined, packageKind: 'unknown' }));
              }}
            >
              Bu değil, türünü ben seçeyim
            </button>
          )}
        </div>
      </div>

      {!c && pickImage && <ImagePicker value={draft.img} onChange={(img) => setDraft({ ...draft, img, imgPicked: true })} onPick={() => setPickImage(false)} />}

      {!c && (
        <div className="field">
          <span className="field__label" id="draft-cat-label">
            Ne tür bir ürün?
            {draft.unsure && <small>{draft.name.trim() ? 'Türünü tahmin edemedik; seç, süreyi ona göre hesaplayalım.' : 'Ne olduğunu seç; süreyi ona göre hesaplarız.'}</small>}
          </span>
          <div className="mini-chips" role="group" aria-labelledby="draft-cat-label">
            {CATEGORIES.map((k) => (
              <button
                type="button"
                key={k.id}
                aria-pressed={draft.category === k.id}
                className={`mini-chip ${draft.category === k.id ? 'is-active' : ''}`}
                onClick={() => setDraft({ ...apply({ category: k.id, img: draft.imgPicked ? draft.img : defaultImg(draft.name, k.id) }), unsure: false })}
              >
                {k.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <div className="field--row">
          <span className="field__label">{qtyLabel}</span>
          <Stepper value={draft.quantity} max={99} onChange={(quantity) => setDraft({ ...draft, quantity })} label={qtyLabel} />
        </div>
        <div className="qty-extra">
          {!unitOpen && (
            <button type="button" className="unit-toggle" aria-expanded={false} onClick={() => setUnitOpen(true)}>
              Birim: <b>{unitName}</b> · <span className="unit-toggle__act">değiştir</span>
            </button>
          )}
          {!unitOpen && qtyChips.length > 0 && (
            <div className="mini-chips qty-chips" role="group" aria-label="Hızlı miktar">
              {qtyChips.map((n) => (
                <button type="button" key={n} aria-pressed={draft.quantity === n} className={`mini-chip ${draft.quantity === n ? 'is-active' : ''}`} onClick={() => setDraft({ ...draft, quantity: n })}>
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
        {unitOpen && (
          <div className="unit-pick">
            <span className="field__label" id="draft-unit-label">
              Neyle sayıyorsun?<small>Gram/ml gerekmez; kabaca yeter.</small>
            </span>
            <div className="mini-chips" role="radiogroup" aria-labelledby="draft-unit-label">
              {UNITS.map((u) => (
                <button
                  type="button"
                  key={u}
                  role="radio"
                  aria-checked={draft.unit === u}
                  className={`mini-chip ${draft.unit === u ? 'is-active' : ''}`}
                  onClick={() => {
                    setDraft({ ...draft, unit: u, unitPicked: true });
                    setUnitOpen(false);
                  }}
                >
                  {UNIT_LABEL[u]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="field">
        <span className="field__label">Nerede saklıyorsun?</span>
        {storages.length === 1 ? (
          <p className="static-value">{STORAGE_LOCATIVE[storages[0]!.id]} saklanır</p>
        ) : (
          <Segmented label="Nerede saklıyorsun?" value={draft.storage} options={storages} onChange={(storage) => setDraft(apply({ storage, opened: storage === 'freezer' ? false : draft.opened, ago: isCooked && storage !== 'freezer' && draft.storage !== 'freezer' ? draft.ago : 0 }))} />
        )}
      </div>

      {isCooked && draft.storage !== 'freezer' && (
        <div className="field">
          <span className="field__label">Ne zaman pişirdin?</span>
          <Segmented
            label="Ne zaman pişirdin?"
            value={String(draft.ago)}
            options={[
              { id: '0', label: 'Bugün' },
              { id: '1', label: 'Dün' },
              { id: '2', label: '2 gün önce' },
              // Gece yarısı geçince ya da "3 gün önce" yazılınca gerçek gün de seçenek olur.
              ...(draft.ago > 2 ? [{ id: String(draft.ago), label: `${draft.ago} gün önce` }] : []),
            ]}
            onChange={(v) => setDraft({ ...draft, ago: Number(v) })}
          />
        </div>
      )}

      {(draft.storage === 'freezer' || longPantry) && !stableItem && (
        <div className="field">
          <span className="field__label">{draft.storage === 'freezer' ? 'Ne zaman dondurdun?' : 'Ne zaman aldın / yaptın?'}</span>
          <Segmented
            label={draft.storage === 'freezer' ? 'Ne zaman dondurdun?' : 'Ne zaman aldın / yaptın?'}
            value={String(draft.ago < 15 ? 0 : draft.ago < 60 ? 30 : draft.ago < 135 ? 90 : 180)}
            options={[
              { id: '0', label: 'Bu hafta' },
              { id: '30', label: '1 ay önce' },
              { id: '90', label: '3 ay önce' },
              { id: '180', label: '6 ay önce' },
            ]}
            onChange={(v) => setDraft({ ...draft, ago: Number(v) })}
          />
        </div>
      )}

      {askBought(draft) && draft.dateSource === 'auto' && (
        <div className="field">
          {boughtOpen ? (
            <>
              <span className="field__label">
                Ne zaman aldın?<small>Süre aldığın günden sayılır.</small>
              </span>
              <DayChoice label="Ne zaman aldın?" value={draft.boughtAt ?? ref} today={ref} onChange={(boughtAt) => setDraft({ ...draft, boughtAt })} />
            </>
          ) : (
            <button type="button" className="draft__collapsed" aria-expanded={false} onClick={() => setBoughtOpen(true)}>
              <span>
                Ne zaman aldın? · <b>{agoText(draft.boughtAt, ref)}</b>
              </span>
              <span className="unit-toggle__act">değiştir</span>
            </button>
          )}
        </div>
      )}

      {showOpened && (
        <div className={`opened-box ${opened ? 'is-on' : ''}`}>
          <div className="field--row">
            <span className="field__label">
              Paketi açıldı mı?
              <small>Açılınca süre kısalır</small>
            </span>
            <Toggle checked={draft.opened} onChange={(o) => setDraft(apply({ opened: o }))} label="Paketi açıldı" />
          </div>
          {opened && (
            <div className="opened-box__body">
              <span className="field__label">Ne zaman açıldı?</span>
              <DayChoice label="Ne zaman açıldı?" value={dates.openedAt} min={dates.boughtAt} today={ref} onChange={(openedAt) => setDraft({ ...draft, openedAt })} />
              {hasLevel(draft.unit) && (
                <>
                  <span className="field__label opened-box__level">
                    Açık olanda ne kadar kaldı?<small>İsteğe bağlı, yaklaşık; tartman gerekmez.</small>
                  </span>
                  <Segmented<Level>
                    label="Açık olanda ne kadar kaldı?"
                    value={draft.level as Level}
                    options={(['full', 'half', 'low'] as Level[]).map((id) => ({ id, label: LEVEL_LABEL[id] }))}
                    onChange={(level) => setDraft({ ...draft, level: draft.level === level ? undefined : level })}
                  />
                </>
              )}
              {draft.quantity > 1 && (
                <p className="opened-box__split" aria-live="polite">
                  <Icon name="box" size={16} /> {qtyText(1, draft.unit)} açık, {qtyText(draft.quantity - 1, draft.unit)} kapalı eklenecek
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {stableItem ? (
        <div className="useby">
          <div className="useby__top">
            <span className="field__label">Son gün</span>
            <span className="pill pill--brand">Bozulmaz</span>
          </div>
          <p className="static-value">Bu ürün pratikte bozulmaz; uyarı vermeyiz.</p>
        </div>
      ) : (
        <div className="useby" role="group" aria-labelledby="useby-label">
          <div className="useby__top">
            <span className="field__label" id="useby-label">
              {opened && draft.quantity > 1 ? 'Açık olanın son günü' : 'Son gün'}
            </span>
            <span className={`pill ${draft.dateSource === 'auto' ? 'pill--brand' : ''}`}>
              {draft.dateSource === 'auto' ? (c ? 'Ortalama süre' : 'Tahmini') : draft.dateSource === 'package' ? 'Paket tarihi' : 'Senin seçimin'}
            </span>
          </div>
          <div className="useby__main">
            <button type="button" className="round-btn" onClick={() => setLeft(left - 1)} disabled={left <= 0} aria-label="Bir gün azalt">
              <Icon name="minus" size={18} stroke={2.5} />
            </button>
            <div className="useby__value" aria-live="polite">
              <strong>{left < 0 ? (draft.storage === 'freezer' ? 'Kalite süresi doldu' : 'Tarihi geçmiş') : left === 0 ? 'Bugün' : left === 1 ? 'Yarın' : left > 60 ? roughDuration(left) : `${left} gün`}</strong>
              <span>{longDate(dates.useBy, ref)}</span>
            </div>
            <button type="button" className="round-btn" onClick={() => setLeft(left + 1)} aria-label="Bir gün artır">
              <Icon name="plus" size={18} stroke={2.5} />
            </button>
          </div>
          {opened && dates.useBy !== dates.base && (
            <p className="useby__note">
              {draft.quantity > 1 ? 'Kapalılar' : 'Kapalıyken'}: {longDate(dates.base, ref)} · açık olan, açıldığı günden sayılır
            </p>
          )}
          {opened && dates.useBy === dates.base && draft.quantity > 1 && <p className="useby__note">Kapalılar da aynı gün: {longDate(dates.base, ref)}</p>}
          <div className="useby__actions">
            {!isCooked && (
              <label className="link-btn">
                <Icon name="calendar" size={16} /> Paketteki tarihi gir (STT/TETT)
                <input
                  type="date"
                  className="visually-hidden-input"
                  aria-label="Paketteki tarih"
                  max="9999-12-31"
                  value={draft.fixedUseBy ?? dates.base}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v || !isDay(v)) return;
                    // Uzun ömürlü ürünün (kuru gıda, kavanoz, kapalı konserve) geçmiş tarihi kaydedilebilir; türünü (STT/TETT) kullanıcı seçer, STT seçilirse kaydetme engellenir.
                    // Taze ürünün geçmiş paket tarihi kaydedilmez.
                    const longLife = !PERISHABLE.has(draft.category) || (!!c?.tett && !draft.opened);
                    if (diffDays(v, ref) < 0 && !longLife) {
                      toast({ text: 'Bu tarih geçmiş. Taze üründe paketteki tarih geçtiyse tüketme.' });
                      return;
                    }
                    if (diffDays(v, ref) < 0) toast({ text: 'Paketteki tarih geçmiş. Türünü seç: STT ise tüketme; TETT ise kontrol et.' });
                    setDraft({ ...draft, fixedUseBy: v, dateSource: 'package' });
                  }}
                />
              </label>
            )}
            {draft.dateSource !== 'auto' && (
              <button type="button" className="link-btn" onClick={() => setDraft({ ...draft, dateSource: 'auto', fixedUseBy: undefined, packageKind: 'unknown' })}>
                <Icon name="undo" size={16} /> Önerilene dön
              </button>
            )}
          </div>
          {draft.dateSource === 'package' && (
            <div className="pkg-kind">
              <span className="field__label" id="pkg-kind-label">
                Paketteki tarih hangisi?
              </span>
              <div className="mini-chips" role="radiogroup" aria-labelledby="pkg-kind-label">
                {PACKAGE_KINDS.map((k) => (
                  <button type="button" key={k.id} role="radio" aria-checked={draft.packageKind === k.id} className={`mini-chip ${draft.packageKind === k.id ? 'is-active' : ''}`} onClick={() => setDraft({ ...draft, packageKind: k.id })}>
                    {k.label}
                  </button>
                ))}
              </div>
              <p className={`pkg-kind__note ${pastStt ? 'is-warn' : ''}`}>{pastStt ? 'Son tüketim tarihi geçmiş; bu ürünü tüketme.' : PACKAGE_NOTE[draft.packageKind]}</p>
            </div>
          )}
          {c?.tip && (
            <p className="tip">
              <Icon name="sparkle" size={16} /> {c.tip}
            </p>
          )}
          {!c && <p className="tip">Bu ürünü tanımıyoruz; süre, türüne göre temkinli bir tahmin. Paketinde tarih varsa onu gir.</p>}
        </div>
      )}

      <div className="draft__footer">
        {/* Açılınca ya da tarih girilince son gün geçmişe düştüyse kaydetmeden önce söylenir. */}
        {!pastStt && left < 0 && !qualityOnly({ storage: draft.storage, category: draft.category, catalogId: draft.catalog?.id, opened, dateSource: draft.dateSource, packageKind: draft.packageKind }) && (
          <p className="draft__warn" role="status">
            Bu ürünün son günü geçmiş görünüyor. Kontrol et; şüphedeysen tüketme.
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={!draft.name.trim() || !!draft.unsure || pastStt}>
          <Icon name={STORAGE_ICON[draft.storage]} size={20} /> {draft.unsure ? 'Önce türünü seç' : pastStt ? 'Tarihi geçmiş' : SUBMIT_LABEL[draft.storage]}
        </button>
      </div>
    </form>
  );
}

/**
 * Görsel seçici: radyo grubu. Oklar (ızgarada yukarı/aşağı satır atlar), Home/End seçimi değiştirir;
 * dokunma ya da Enter/Boşluk seçip kapatır. Yalnızca seçili görsel sekme sırasındadır.
 */
function ImagePicker({ value, onChange, onPick }: { value: string; onChange: (img: string) => void; onPick: () => void }) {
  const current = PICKABLE_IMAGES.includes(value) ? value : PICKABLE_IMAGES[0];
  return (
    <div
      className="img-picker"
      role="radiogroup"
      aria-label="Görsel"
      onKeyDown={(e) => {
        const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
        if (!keys.includes(e.key)) return;
        e.preventDefault();
        const group = e.currentTarget;
        const btns = [...group.querySelectorAll<HTMLButtonElement>('button[role="radio"]')];
        const i = Math.max(0, PICKABLE_IMAGES.indexOf(current!));
        // Bir satırdaki görsel sayısı (ızgara genişliğe göre değişir).
        const cols = Math.max(1, btns.filter((b) => b.offsetTop === btns[0]?.offsetTop).length);
        const n = PICKABLE_IMAGES.length;
        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols } as Record<string, number>;
        let j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : i + step[e.key]!;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') j = (j + n) % n;
        else j = Math.min(n - 1, Math.max(0, j));
        const next = PICKABLE_IMAGES[j]!;
        onChange(next);
        btns[j]?.focus();
        btns[j]?.scrollIntoView({ block: 'nearest' });
      }}
    >
      {PICKABLE_IMAGES.map((img) => (
        <button
          type="button"
          key={img}
          role="radio"
          aria-checked={value === img}
          tabIndex={current === img ? 0 : -1}
          aria-label={imageLabel(img)}
          className={value === img ? 'is-active' : ''}
          onClick={() => {
            onChange(img);
            onPick();
          }}
        >
          <img src={foodImageUrl(img)} alt="" width={30} height={30} />
        </button>
      ))}
    </div>
  );
}

/** Ürün görselini dokunulan karttan küçük buzdolabına uçurur; buzdolabının içine girerken küçülür. */
function flyToFridge(img: string, from: DOMRect | null, target: HTMLElement | null, reduced: boolean): Promise<void> {
  if (reduced || !target || typeof document.body.animate !== 'function') return Promise.resolve();
  let to = target.getBoundingClientRect();
  // Dar ekranda mini dolap gizli: ürün "Tamam" düğmesine uçar.
  if (to.width === 0) to = document.querySelector('.add__done')?.getBoundingClientRect() ?? to;
  if (to.width === 0) return Promise.resolve();
  const start = from ?? new DOMRect(window.innerWidth / 2 - 30, window.innerHeight * 0.6, 60, 60);
  const el = document.createElement('img');
  el.src = foodImageUrl(img);
  el.className = 'flyer';
  el.alt = '';
  el.style.left = `${start.left + start.width / 2 - 28}px`;
  el.style.top = `${start.top + start.height / 2 - 28}px`;
  document.body.appendChild(el);
  const dx = to.left + to.width / 2 - (start.left + start.width / 2);
  const dy = to.top + to.height / 2 - (start.top + start.height / 2);
  const anim = el.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1, easing: 'cubic-bezier(.2,.7,.3,1)' },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 70}px) scale(0.85) rotate(-14deg)`, opacity: 1, offset: 0.45, easing: 'ease-in' },
      { transform: `translate(${dx}px, ${dy}px) scale(0.24)`, opacity: 1, offset: 0.85 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.18)`, opacity: 0 },
    ],
    { duration: FLY_MS, easing: 'linear' },
  );
  return anim.finished.then(
    () => el.remove(),
    () => el.remove(),
  );
}
