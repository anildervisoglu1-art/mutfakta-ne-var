import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { today } from '../lib/dates';
import { canFreeze, canOpen, effectiveUseBy, estimateBase, openedDaysFor, storageAfterOpening, useByAfterThaw, useByIfMovedToFridge, useByInFreezer } from '../lib/freshness';
import { addDays, diffDays } from '../lib/dates';
import { cleanHistory, cleanItem, cleanList, cleanPlan, cleanShopping } from '../lib/validate';
import { hasLevel, lowerLevel, unitOf } from '../lib/units';
import { searchKey } from '../data/catalog';
import type { DayString, FridgeItem, HistoryEntry, Outcome, PackageKind, Plan, Settings, ShoppingItem, Unit } from '../types';
import { buildDemoItems } from '../data/demo';
import { getCatalogItem, LEGACY_IMG } from '../data/catalog';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export type NewItem = Omit<FridgeItem, 'id' | 'addedAt'> & { addedAt?: string };
/** Değişen ürün; `created` ise yığından ayrılıp yeni satır olarak eklendi. */
export type Changed = { id: string; created: boolean; merged?: boolean };
export const MAX_QTY = 99;

/**
 * Eski kayıtları güncel modele taşır (depodan ve yedekten yüklerken). Hiçbir kayıt silinmez.
 * v1 → v2: "Tezgâh" eklendi; kilerde duran meyve/ekmek tezgâha taşınır.
 * v2 → v3: tarih alanları ayrıldı. Kapalı ürünün mevcut tarihi kapalı sınır olur; yemekte eklenme günü pişirilme günüdür;
 * eski paket tarihlerinin türü bilinmediğinden "Bilmiyorum" sayılır.
 */
export function migrateItems(items: FridgeItem[]): FridgeItem[] {
  return items.map((i) => {
    if (!i) return i;
    const c = getCatalogItem(i.catalogId);
    let next = freshImg(i);
    if (next.storage === 'pantry' && c && c.days.pantry === undefined && c.days.counter !== undefined) next = { ...next, storage: 'counter' as const };
    if (next.baseUseBy === undefined && !next.opened) next = { ...next, baseUseBy: next.useBy };
    // Eski açık ürünlerde açılma günü yoktu: tarihinden geriye tahmin edilir; böylece sonraki düzenlemeler açık ömrünü kaldırmaz.
    if (next.opened && !next.openedAt) next = { ...next, ...inferOpened(next) };
    if (next.category === 'yemek' && !next.cookedAt) next = { ...next, cookedAt: next.addedAt };
    if (next.dateSource === 'package' && !next.packageKind) next = { ...next, packageKind: 'unknown' };
    return next;
  });
}

/** Ürünün eski varsayılan görseli yenisiyle değişir; kullanıcının seçtiği görsel korunur. */
export function freshImg<T extends { catalogId?: string; img: string }>(x: T): T {
  const c = getCatalogItem(x.catalogId);
  return c && x.catalogId && LEGACY_IMG[x.catalogId] === x.img ? { ...x, img: c.img } : x;
}

/** Açılma günü bilinmeyen açık ürün: "son gün − açık ömrü" (eklenme gününden önce olamaz). */
function inferOpened(i: FridgeItem): Pick<FridgeItem, 'openedAt' | 'baseUseBy'> {
  const days = openedDaysFor(i);
  const guess = days === undefined ? i.addedAt : addDays(i.useBy, -days);
  return { openedAt: diffDays(guess, i.addedAt) < 0 ? i.addedAt : guess, baseUseBy: i.baseUseBy ?? i.useBy };
}

/** Aynı ürün sayılabilecek iki satır (birleştirilir). */
const sameStock = (a: FridgeItem | NewItem, b: FridgeItem | NewItem) =>
  a.catalogId === b.catalogId &&
  a.name === b.name &&
  a.storage === b.storage &&
  a.useBy === b.useBy &&
  a.opened === b.opened &&
  !!a.thawed === !!b.thawed &&
  a.dateSource === b.dateSource &&
  a.packageKind === b.packageKind &&
  a.openedAt === b.openedAt &&
  a.level === b.level &&
  !!a.fromRecipe === !!b.fromRecipe &&
  unitOf(a) === unitOf(b);

const DEFAULT_SETTINGS: Settings = { leadDays: 2, notifications: false };

export type ShoppingAdd = { item: ShoppingItem; existed: boolean; dropped: ShoppingItem[] };
export type NewShopping = { name: string; catalogId?: string; img: string; category: ShoppingItem['category']; quantity?: number; unit: Unit };

interface FridgeState {
  items: FridgeItem[];
  history: HistoryEntry[];
  settings: Settings;
  /** Aynı ürün (aynı yer, tarih, açıklık) zaten varsa miktarını artırır. `prevQuantity`: eklemeden önceki miktar (yeni satırsa 0). */
  add: (item: NewItem) => { item: FridgeItem; merged: boolean; prevQuantity: number };
  update: (id: string, patch: Partial<FridgeItem>) => void;
  /** Miktarı değiştirir; 0'a inerse bir kez "bitti" kaydı oluşturur ve geçmiş kaydının id'sini döner. */
  setQuantity: (id: string, quantity: number) => string | undefined;
  /** "Biraz kullandım": paketin bir tanesi açılır ya da açık paketin doluluğu bir basamak iner; ürün silinmez. */
  useSome: (id: string) => Changed | undefined;
  /** Alınma/açılma/pişirilme günü değişince son gün yeniden hesaplanır. */
  setDates: (id: string, patch: { boughtAt?: DayString | null; openedAt?: DayString; cookedAt?: DayString }) => void;
  /** Paketteki tarih ve türü (STT/TETT/Bilmiyorum). */
  setPackageDate: (id: string, day: DayString, kind: PackageKind) => void;
  /** Elle girilen son gün. */
  setManualDate: (id: string, day: DayString) => void;
  shopping: ShoppingItem[];
  /** İleriye dönük planlar ("Pazar: ıspanak yemeği"). */
  plans: Plan[];
  addPlan: (input: Omit<Plan, 'id' | 'createdAt'>) => Plan;
  updatePlan: (id: string, patch: Partial<Plan>) => void;
  removePlan: (id: string) => void;
  /** Aynı ürün listede (alınmamış) varsa yeni satır açılmaz; o satır döner. `dropped`: yerine geçilen "alındı" satırları. */
  addShopping: (input: NewShopping) => ShoppingAdd;
  /** addShopping'i geri alır: yeni satırı kaldırır, yerine geçtiği "alındı" satırlarını geri koyar. */
  undoShopping: (r: ShoppingAdd) => void;
  updateShopping: (id: string, patch: Partial<ShoppingItem>) => void;
  removeShopping: (id: string) => void;
  /** Ürünü (ya da bir kısmını) yenmiş/atılmış olarak kapatır; geçmiş kaydının id'sini döner. */
  finish: (id: string, outcome: Outcome, quantity?: number) => string | undefined;
  remove: (id: string) => void;
  /** Geri al: ürünü önceki hâline döndürür, verilen geçmiş kayıtlarını siler. */
  restore: (item: FridgeItem, historyIds?: (string | undefined)[]) => void;
  /** Açtım / Dondur / Buzdolabına al / Çözdür: yığında birden çok paket varsa yalnızca 1 tanesi değişir. */
  open: (id: string, openedAt?: DayString) => Changed | undefined;
  freeze: (id: string) => Changed | undefined;
  moveToFridge: (id: string) => Changed | undefined;
  thaw: (id: string) => Changed | undefined;
  /** Özet'ten: geçmiş kaydını geri al, ürünü mutfağa döndür. */
  revert: (historyId: string) => boolean;
  setSettings: (patch: Partial<Settings>) => void;
  loadDemo: () => void;
  replaceAll: (data: { items: FridgeItem[]; history: HistoryEntry[]; settings?: Settings; shopping?: ShoppingItem[]; plans?: Plan[] }) => void;
  reset: () => void;
}

export const useFridge = create<FridgeState>()(
  persist(
    (set, get) => {
      /** Yığından 1 tanesini ayırıp değiştir; tek taneyse kendisini değiştir. */
      const splitOne = (item: FridgeItem, patch: Partial<FridgeItem>): Changed => {
        if (item.quantity <= 1) {
          set((s) => ({ items: s.items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)) }));
          return { id: item.id, created: false };
        }
        const piece: FridgeItem = { ...item, ...patch, id: uid(), quantity: 1 };
        // Aynı durumda bir satır zaten varsa (ör. daha önce dondurulmuş 1 tavuk) ona eklenir.
        const twin = get().items.find(
          (i) => i.id !== item.id && sameStock(i, piece) && (i.boughtAt ?? '') === (piece.boughtAt ?? '') && (i.cookedAt ?? '') === (piece.cookedAt ?? '') && (i.baseUseBy ?? '') === (piece.baseUseBy ?? ''),
        );
        if (twin) {
          set((s) => ({ items: s.items.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i.id === twin.id ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + 1) } : i)) }));
          return { id: twin.id, created: false, merged: true };
        }
        set((s) => ({ items: [...s.items.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i)), piece] }));
        return { id: piece.id, created: true };
      };
      return {
      items: [],
      history: [],
      shopping: [],
      plans: [],
      settings: DEFAULT_SETTINGS,

      add: (raw) => {
        const addedAt = raw.addedAt ?? today();
        // Kapalı ürünün tarihi kapalı sınırdır; açılınca "açık ömrü" bunun üstüne uygulanır.
        const input: NewItem = raw.baseUseBy === undefined && !raw.opened ? { ...raw, baseUseBy: raw.useBy } : raw;
        const same = get().items.find((i) => sameStock(i, input) && (i.boughtAt ?? '') === (input.boughtAt ?? '') && (i.cookedAt ?? '') === (input.cookedAt ?? ''));
        if (same) {
          const merged = { ...same, quantity: Math.min(MAX_QTY, same.quantity + input.quantity) };
          set((s) => ({ items: s.items.map((i) => (i.id === same.id ? merged : i)) }));
          return { item: merged, merged: true, prevQuantity: same.quantity };
        }
        const item: FridgeItem = { ...input, quantity: Math.min(MAX_QTY, input.quantity), id: uid(), addedAt };
        set((s) => ({ items: [...s.items, item] }));
        return { item, merged: false, prevQuantity: 0 };
      },

      update: (id, patch) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),

      setQuantity: (id, quantity) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return undefined;
        const q = Math.max(0, Math.min(MAX_QTY, Math.floor(quantity)));
        if (q === 0) return get().finish(id, 'eaten');
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, quantity: q } : i)) }));
        return undefined;
      },

      useSome: (id) => {
        const item = get().items.find((i) => i.id === id);
        if (!item || item.storage === 'freezer' || !hasLevel(unitOf(item))) return undefined;
        if (item.opened) {
          // Zaten "Az kaldı": değişen bir şey yok (aynı iki satır oluşmasın).
          if (item.level === 'low') return { id, created: false };
          const level = lowerLevel(item.level);
          // Aynı gün açılmış iki şişe tek satırdaysa yalnızca biri azalır.
          if (item.quantity > 1) return splitOne(item, { level });
          set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, level } : i)) }));
          return { id, created: false };
        }
        // Kapalı paketten kullanmak onu açmaktır: yalnızca bir tanesi açılır.
        const openedAt = today();
        const base = item.baseUseBy ?? item.useBy;
        const storage = storageAfterOpening(item);
        const next = { ...item, opened: true, openedAt, baseUseBy: base, storage, level: 'half' as const };
        return splitOne(item, { opened: true, openedAt, baseUseBy: base, storage, level: 'half', useBy: canOpen(item) ? effectiveUseBy(next) : item.useBy });
      },

      setDates: (id, patch) =>
        set((s) => ({
          items: s.items.map((i) => {
            if (i.id !== id) return i;
            let next: FridgeItem = { ...i };
            if (next.opened && !next.openedAt) next = { ...next, ...inferOpened(next) };
            if (patch.boughtAt === null) delete next.boughtAt;
            else if (patch.boughtAt) next.boughtAt = patch.boughtAt;
            if (patch.cookedAt) next.cookedAt = patch.cookedAt;
            if (patch.openedAt) next.openedAt = patch.openedAt;
            // Elle girilen son gün korunur: tarih alanları yalnızca kaydedilir.
            if (next.dateSource === 'manual') return next;
            const datesChanged = patch.boughtAt !== undefined || !!patch.cookedAt;
            if (next.dateSource === 'auto' && datesChanged) {
              if (next.storage === 'freezer' || next.thawed) {
                // Dondurma/çözdürme günü esas alınmıştı; alınma günü bunu değiştirmez.
              } else {
                // Mevcut tahmin, başlangıç günü (alınma/pişirilme, yoksa eklenme) ne kadar kaydıysa o kadar kayar.
                // Yeniden tahmin edilmez: açınca dolaba geçen meyve ya da tariften artan yemek kendi süresini korur.
                const refOf = (x: FridgeItem) => (x.category === 'yemek' ? (x.cookedAt ?? x.boughtAt ?? x.addedAt) : (x.boughtAt ?? x.addedAt));
                next.baseUseBy = addDays(next.baseUseBy ?? i.baseUseBy ?? i.useBy, diffDays(refOf(next), refOf(i)));
              }
            }
            if (next.baseUseBy === undefined) next.baseUseBy = i.useBy;
            next.useBy = effectiveUseBy(next);
            return next;
          }),
        })),

      setPackageDate: (id, day, kind) =>
        set((s) => ({
          items: s.items.map((i) => {
            if (i.id !== id) return i;
            const next: FridgeItem = { ...i, ...(i.opened && !i.openedAt ? inferOpened(i) : {}), dateSource: 'package', packageKind: kind, baseUseBy: day };
            return { ...next, useBy: effectiveUseBy(next) };
          }),
        })),

      setManualDate: (id, day) =>
        set((s) => ({
          items: s.items.map((i) => {
            if (i.id !== id) return i;
            const { packageKind: _k, ...rest } = i;
            void _k;
            return { ...rest, dateSource: 'manual', baseUseBy: day, useBy: day };
          }),
        })),

      addShopping: (input) => {
        // Aynı ürün: aynı katalog bağlantısı VE aynı ad ("Kola" ile "Maden suyu" aynı kalemde olsa da ayrı ürünlerdir).
        // Aynı ürün: ad aynı ve katalog bağlantısı aynı (ya da birinde bağlantı yok).
        const same = (x: { catalogId?: string; name: string }) => searchKey(x.name) === searchKey(input.name) && (!x.catalogId || !input.catalogId || x.catalogId === input.catalogId);
        const existing = get().shopping.find((x) => !x.done && same(x));
        if (existing) return { item: existing, existed: true, dropped: [] };
        const item: ShoppingItem = { id: uid(), name: input.name.trim().slice(0, 60), catalogId: input.catalogId, img: input.img, category: input.category, quantity: Math.max(1, Math.min(MAX_QTY, input.quantity ?? 1)), unit: input.unit, done: false, addedAt: today() };
        // Daha önce alınmış aynı satır listeden kalkar; yerine yenisi gelir.
        const dropped = get().shopping.filter((x) => x.done && same(x));
        set((s) => ({ shopping: [item, ...s.shopping.filter((x) => !dropped.includes(x))] }));
        return { item, existed: false, dropped };
      },

      undoShopping: (r) =>
        set((s) => ({ shopping: [...(r.existed ? s.shopping : s.shopping.filter((x) => x.id !== r.item.id)), ...r.dropped.filter((d) => !s.shopping.some((x) => x.id === d.id))] })),

      updateShopping: (id, patch) => set((s) => ({ shopping: s.shopping.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

      removeShopping: (id) => set((s) => ({ shopping: s.shopping.filter((x) => x.id !== id) })),

      addPlan: (input) => {
        const plan: Plan = { ...input, title: input.title.trim().slice(0, 60), id: uid(), createdAt: today() };
        set((s) => ({ plans: [...s.plans, plan].sort((a, b) => a.day.localeCompare(b.day)) }));
        return plan;
      },

      updatePlan: (id, patch) => set((s) => ({ plans: s.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)).sort((a, b) => a.day.localeCompare(b.day)) })),

      removePlan: (id) => set((s) => ({ plans: s.plans.filter((p) => p.id !== id) })),

      finish: (id, outcome, quantity) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return undefined;
        const q = Math.max(1, Math.min(item.quantity, quantity ?? item.quantity));
        const entry: HistoryEntry = {
          id: uid(),
          name: item.name,
          img: item.img,
          category: item.category,
          outcome,
          date: today(),
          quantity: q,
          unit: unitOf(item),
          ...(item.fromRecipe && outcome === 'eaten' ? { derived: true } : {}),
          item: { ...item, quantity: q },
        };
        set((s) => ({
          history: [entry, ...s.history].slice(0, 500),
          items: q >= item.quantity ? s.items.filter((i) => i.id !== id) : s.items.map((i) => (i.id === id ? { ...i, quantity: i.quantity - q } : i)),
        }));
        return entry.id;
      },

      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      restore: (item, historyIds = []) =>
        set((s) => {
          const exists = s.items.some((i) => i.id === item.id);
          const drop = new Set(historyIds.filter(Boolean));
          return {
            items: exists ? s.items.map((i) => (i.id === item.id ? item : i)) : [...s.items, item],
            history: drop.size ? s.history.filter((h) => !drop.has(h.id)) : s.history,
          };
        }),

      open: (id, openedAt = today()) => {
        const item = get().items.find((i) => i.id === id);
        if (!item || !canOpen(item)) return undefined;
        const base = item.baseUseBy ?? item.useBy;
        const patch: Partial<FridgeItem> = { opened: true, openedAt, baseUseBy: base, storage: storageAfterOpening(item), ...(hasLevel(unitOf(item)) ? { level: 'full' as const } : {}) };
        return splitOne(item, { ...patch, useBy: effectiveUseBy({ ...item, ...patch }) });
      },

      moveToFridge: (id) => {
        const item = get().items.find((i) => i.id === id);
        const useBy = item && useByIfMovedToFridge(item);
        if (!item || !useBy) return undefined;
        // Kapalı sınır dolap tahminidir (açık ömrü useBy'da ayrıca uygulanır); böylece sonraki tarih düzenlemesi eski kiler tarihine dönmez.
        return splitOne(item, { storage: 'fridge', useBy, baseUseBy: estimateBase({ ...item, storage: 'fridge' }), dateSource: 'auto' });
      },

      freeze: (id) => {
        const item = get().items.find((i) => i.id === id);
        if (!item || !canFreeze(item)) return undefined;
        const useBy = useByInFreezer(item);
        return splitOne(item, { storage: 'freezer', useBy, baseUseBy: useBy, dateSource: 'auto', opened: false });
      },

      thaw: (id) => {
        const item = get().items.find((i) => i.id === id);
        if (!item || item.storage !== 'freezer') return undefined;
        const useBy = useByAfterThaw(item);
        return splitOne(item, { storage: 'fridge', useBy, baseUseBy: useBy, dateSource: 'auto', thawed: true });
      },

      revert: (historyId) => {
        const entry = get().history.find((h) => h.id === historyId);
        if (!entry?.item) return false;
        const snap = entry.item;
        set((s) => {
          const exists = s.items.find((i) => i.id === snap.id);
          // Satır o arada değiştiyse (dondurulduysa, tarihi düzeltildiyse) üstüne eklenmez, ayrı satır olarak döner.
          const same = exists && sameStock(exists, snap);
          return {
            items: same
              ? s.items.map((i) => (i.id === snap.id ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + entry.quantity) } : i))
              : [...s.items, { ...snap, id: exists ? uid() : snap.id, quantity: entry.quantity }],
            history: s.history.filter((h) => h.id !== historyId),
          };
        });
        return true;
      },

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      loadDemo: () => set({ items: buildDemoItems(today()) }),

      replaceAll: ({ items, history, settings, shopping, plans }) => set((s) => ({ items: items.map(freshImg), history: history.map(freshImg), shopping: shopping?.map(freshImg) ?? s.shopping, plans: plans?.map(freshImg) ?? s.plans, settings: settings ? { ...s.settings, ...settings } : s.settings })),

      reset: () => set({ items: [], history: [], shopping: [], plans: [] }),
      };
    },
    {
      name: 'dolapta-ne-var',
      version: 3,
      // Eski sürümlerin kayıtları korunur; yalnızca yeni alanlar doldurulur (bkz. migrateItems).
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<FridgeState>;
        if (Array.isArray(p.items)) p.items = migrateItems(p.items);
        return p as FridgeState;
      },
      // Depodaki veri bozulmuşsa uygulama çökmesin: geçersiz kayıtları ayıkla.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FridgeState>;
        const s = p.settings && typeof p.settings === 'object' ? p.settings : {};
        const leadDays = [1, 2, 3].includes(Number((s as Settings).leadDays)) ? Number((s as Settings).leadDays) : DEFAULT_SETTINGS.leadDays;
        return {
          ...current,
          items: migrateItems(cleanList(p.items, cleanItem).ok),
          history: cleanList(p.history, cleanHistory).ok.map(freshImg),
          shopping: cleanList(p.shopping, cleanShopping).ok.map(freshImg),
          plans: cleanList(p.plans, cleanPlan).ok.map(freshImg),
          settings: { ...DEFAULT_SETTINGS, ...(s as Settings), leadDays, ...((s as Settings).calendarHintSeen ? { reminderCardDismissed: true } : {}) },
        };
      },
    },
  ),
);
