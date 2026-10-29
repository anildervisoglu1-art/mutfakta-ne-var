import { CATEGORIES, PICKABLE_IMAGES, STORAGES } from '../data/catalog';
import type { FridgeItem, HistoryEntry, Level, PackageKind, ShoppingItem, Unit } from '../types';
import { UNITS } from './units';
import { parseDay, toDay } from './dates';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (v: unknown): v is string => typeof v === 'string' && DAY.test(v) && toDay(parseDay(v)) === v;
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const CATS = new Set<string>(CATEGORIES.map((c) => c.id));
const STOR = new Set<string>(STORAGES.map((s) => s.id));
const IMGS = new Set<string>([...PICKABLE_IMAGES, ...CATEGORIES.map((c) => c.img)]);
/** Yalnızca bilinen görseller; bilinmeyen (ör. "javascript:…") yerine kategori görseli. */
const cleanImg = (img: unknown, category: string) => (typeof img === 'string' && IMGS.has(img) ? img : CATEGORIES.find((c) => c.id === category)!.img);

/** Yedekten ya da depodan gelen ürünü doğrular; bozuksa undefined döner. */
export function cleanItem(raw: unknown): FridgeItem | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (!isStr(r.id) || !isStr(r.name) || !isDay(r.useBy) || !isDay(r.addedAt)) return undefined;
  if (!CATS.has(r.category as string) || !STOR.has(r.storage as string)) return undefined;
  const quantity = Math.max(1, Math.min(99, Math.floor(Number(r.quantity) || 1)));
  return {
    id: r.id,
    catalogId: isStr(r.catalogId) ? r.catalogId : undefined,
    name: r.name.slice(0, 60),
    img: cleanImg(r.img, r.category as string),
    category: r.category as FridgeItem['category'],
    storage: r.storage as FridgeItem['storage'],
    quantity,
    addedAt: r.addedAt,
    useBy: r.useBy,
    opened: r.opened === true,
    dateSource: r.dateSource === 'package' || r.dateSource === 'manual' ? r.dateSource : 'auto',
    ...(r.thawed === true ? { thawed: true } : {}),
    ...(isUnit(r.unit) ? { unit: r.unit } : {}),
    ...(LEVELS.has(r.level as string) ? { level: r.level as Level } : {}),
    ...(isDay(r.boughtAt) ? { boughtAt: r.boughtAt } : {}),
    ...(isDay(r.openedAt) ? { openedAt: r.openedAt } : {}),
    ...(isDay(r.cookedAt) ? { cookedAt: r.cookedAt } : {}),
    ...(isDay(r.baseUseBy) ? { baseUseBy: r.baseUseBy } : {}),
    ...(KINDS.has(r.packageKind as string) ? { packageKind: r.packageKind as PackageKind } : {}),
    ...(r.fromRecipe === true ? { fromRecipe: true } : {}),
  };
}

const UNIT_SET = new Set<string>(UNITS);
const isUnit = (v: unknown): v is Unit => typeof v === 'string' && UNIT_SET.has(v);
const LEVELS = new Set(['full', 'half', 'low']);
const KINDS = new Set(['stt', 'tett', 'unknown']);

export function cleanShopping(raw: unknown): ShoppingItem | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (!isStr(r.id) || !isStr(r.name) || !CATS.has(r.category as string)) return undefined;
  return {
    id: r.id,
    name: r.name.slice(0, 60),
    catalogId: isStr(r.catalogId) ? r.catalogId : undefined,
    img: cleanImg(r.img, r.category as string),
    category: r.category as ShoppingItem['category'],
    quantity: Math.max(1, Math.min(99, Math.floor(Number(r.quantity) || 1))),
    unit: isUnit(r.unit) ? r.unit : 'adet',
    done: r.done === true,
    addedAt: isDay(r.addedAt) ? r.addedAt : toDay(new Date()),
  };
}

export function cleanHistory(raw: unknown): HistoryEntry | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (!isStr(r.id) || !isStr(r.name) || !isDay(r.date) || !CATS.has(r.category as string)) return undefined;
  if (r.outcome !== 'eaten' && r.outcome !== 'wasted') return undefined;
  return {
    id: r.id,
    name: r.name.slice(0, 60),
    img: cleanImg(r.img, r.category as string),
    category: r.category as HistoryEntry['category'],
    outcome: r.outcome,
    date: r.date,
    quantity: Math.max(1, Math.floor(Number(r.quantity) || 1)),
    ...(isUnit(r.unit) ? { unit: r.unit } : {}),
    ...(r.derived === true ? { derived: true } : {}),
    ...(cleanItem(r.item) ? { item: cleanItem(r.item) } : {}),
  };
}

/** Geçersiz ve kimliği tekrar eden kayıtları ayıklar. */
export function cleanList<T extends { id: string }>(list: unknown, fn: (x: unknown) => T | undefined): { ok: T[]; skipped: number } {
  if (!Array.isArray(list)) return { ok: [], skipped: 0 };
  const seen = new Set<string>();
  const ok = list.map(fn).filter((x): x is T => {
    if (x === undefined || seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
  return { ok, skipped: list.length - ok.length };
}
