import { beforeEach, describe, expect, it } from 'vitest';
import { migrateItems, useFridge, type NewItem } from './useFridge';
import { addDays, today } from '../lib/dates';
import { daysLeft, qualityOnly, urgency } from '../lib/freshness';
import { calendarChanges, calendarSignature } from '../lib/calendar';
import { cleanItem, cleanList, cleanShopping } from '../lib/validate';
import type { FridgeItem } from '../types';

const T = today();
const yogurt = (q = 1): NewItem => ({ catalogId: 'yogurt', name: 'Yoğurt', img: '🥣', category: 'sut', storage: 'fridge', quantity: q, opened: false, useBy: addDays(T, 14), dateSource: 'auto' });
const s = () => useFridge.getState();

beforeEach(() => {
  useFridge.setState({ items: [], history: [], shopping: [] });
});

describe('açılma tarihi', () => {
  it('üç gün önce açılmış yoğurdun süresi bugünden başlamaz', () => {
    const { item } = s().add(yogurt());
    s().open(item.id, addDays(T, -3));
    const y = s().items[0]!;
    // Yoğurt açılınca 4 gün: 3 gün önce açıldıysa 1 gün kalır.
    expect(daysLeft(y, T)).toBe(1);
    expect(y.openedAt).toBe(addDays(T, -3));
    expect(y.baseUseBy).toBe(addDays(T, 14));
  });

  it('açılma günü sonradan değişince kalan gün güncellenir', () => {
    const { item } = s().add(yogurt());
    s().open(item.id);
    expect(daysLeft(s().items[0]!, T)).toBe(4);
    s().setDates(item.id, { openedAt: addDays(T, -2) });
    expect(daysLeft(s().items[0]!, T)).toBe(2);
  });

  it('paketteki tarih açılma sınırından erkense o geçerli', () => {
    const { item } = s().add(yogurt());
    s().setPackageDate(item.id, addDays(T, 2), 'stt');
    s().open(item.id);
    expect(daysLeft(s().items[0]!, T)).toBe(2);
  });

  it('birden fazla paketten yalnızca biri açılır', () => {
    const { item } = s().add(yogurt(3));
    s().open(item.id);
    const rows = s().items;
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.opened)?.quantity).toBe(1);
    expect(rows.find((r) => !r.opened)?.quantity).toBe(2);
  });
});

describe('miktar', () => {
  it('kısmi kullanım ürünü silmez', () => {
    const { item } = s().add({ ...yogurt(), catalogId: 'sut', name: 'Süt', img: '🥛', useBy: addDays(T, 5) });
    s().useSome(item.id);
    expect(s().items).toHaveLength(1);
    expect(s().items[0]!.opened).toBe(true);
    expect(s().items[0]!.level).toBe('half');
    s().useSome(item.id);
    s().useSome(item.id);
    expect(s().items).toHaveLength(1);
    expect(s().items[0]!.level).toBe('low');
    expect(s().history).toHaveLength(0);
  });

  it('kapalı paketlerden biraz kullanmak yalnızca birini açar', () => {
    const { item } = s().add(yogurt(2));
    s().useSome(item.id);
    expect(s().items.map((i) => [i.quantity, i.opened]).sort()).toEqual([
      [1, false],
      [1, true],
    ]);
  });

  it('miktar sıfıra inince tek bir tüketim kaydı oluşur ve geri alınabilir', () => {
    const { item } = s().add({ ...yogurt(), catalogId: 'yumurta', name: 'Yumurta', img: '🥚', quantity: 2, useBy: addDays(T, 20) });
    const snap = { ...s().items[0]! };
    expect(s().setQuantity(item.id, 1)).toBeUndefined();
    expect(s().history).toHaveLength(0);
    const hid = s().setQuantity(item.id, 0);
    expect(s().items).toHaveLength(0);
    expect(s().history).toHaveLength(1);
    expect(s().history[0]!.unit).toBe('adet');
    s().restore(snap, [hid]);
    expect(s().items[0]!.quantity).toBe(2);
    expect(s().history).toHaveLength(0);
  });

  it('tariften artan yemeğin yenmesi türetilmiş kayıt olur', () => {
    const { item } = s().add({ catalogId: 'ev-yemegi', name: 'Menemen', img: '🍳', category: 'yemek', storage: 'fridge', quantity: 1, opened: false, useBy: addDays(T, 3), dateSource: 'auto', fromRecipe: true });
    s().finish(item.id, 'eaten');
    expect(s().history[0]!.derived).toBe(true);
  });
});

describe('alışveriş listesi', () => {
  it('aynı ürün tekrar eklenince çoğalmaz', () => {
    const a = s().addShopping({ name: 'Süt', catalogId: 'sut', img: '🥛', category: 'sut', unit: 'sise' });
    const b = s().addShopping({ name: 'Süt', catalogId: 'sut', img: '🥛', category: 'sut', unit: 'sise' });
    const c = s().addShopping({ name: 'domates', img: '🍅', category: 'sebze', unit: 'adet' });
    const d = s().addShopping({ name: 'Domates', img: '🍅', category: 'sebze', unit: 'adet' });
    expect(a.existed).toBe(false);
    expect(b.existed).toBe(true);
    expect(c.existed).toBe(false);
    expect(d.existed).toBe(true);
    expect(s().shopping).toHaveLength(2);
  });

  it('alındı işareti mutfağa ürün eklemez', () => {
    const { item } = s().addShopping({ name: 'Süt', catalogId: 'sut', img: '🥛', category: 'sut', unit: 'sise' });
    s().updateShopping(item.id, { done: true });
    expect(s().items).toHaveLength(0);
  });
});

describe('STT / TETT / bilinmiyor', () => {
  it('kullanıcının seçtiği tür saklanır ve uygulanır', () => {
    const { item } = s().add(yogurt());
    s().setPackageDate(item.id, addDays(T, -1), 'stt');
    expect(urgency(s().items[0]!, 2, T)).toBe('expired');
    s().setPackageDate(item.id, addDays(T, -1), 'tett');
    expect(qualityOnly(s().items[0]!)).toBe(true);
    s().setPackageDate(item.id, addDays(T, -1), 'unknown');
    // Bilinmiyorsa kesin TETT gibi yorumlanmaz: bozulabilir üründe tarih geçince "geçti" sayılır.
    expect(qualityOnly(s().items[0]!)).toBe(false);
  });
});

describe('takvim güncelleme ihtiyacı', () => {
  const setup = () => {
    const { item } = s().add(yogurt(2));
    const saved = { sig: calendarSignature(s().items, T), lead: 2 };
    return { id: item.id, saved };
  };
  it('değişiklik yokken güncel', () => {
    const { saved } = setup();
    expect(calendarChanges(s().items, saved, 2, T).total).toBe(0);
  });
  it('tarih değişikliği algılanır', () => {
    const { id, saved } = setup();
    s().setManualDate(id, addDays(T, 5));
    expect(calendarChanges(s().items, saved, 2, T).changed).toBe(1);
  });
  it('açma, tüketme, dondurma, ekleme ve uyarı süresi algılanır', () => {
    const { id, saved } = setup();
    s().open(id);
    expect(calendarChanges(s().items, saved, 2, T).total).toBeGreaterThan(0);
    useFridge.setState({ items: [] });
    s().add(yogurt(2));
    const saved2 = { sig: calendarSignature(s().items, T), lead: 2 };
    const id2 = s().items[0]!.id;
    s().finish(id2, 'eaten', 1);
    expect(calendarChanges(s().items, saved2, 2, T).changed).toBe(1);
    s().finish(id2, 'eaten');
    expect(calendarChanges(s().items, saved2, 2, T).removed).toBe(1);
    s().add({ ...yogurt(), name: 'Süt', catalogId: 'sut' });
    expect(calendarChanges(s().items, saved2, 2, T).added).toBe(1);
    expect(calendarChanges([], { sig: {}, lead: 2 }, 3, T).total).toBe(0);
  });
  it('dondurma algılanır', () => {
    const { item } = s().add({ catalogId: 'tavuk', name: 'Tavuk', img: '🍗', category: 'et', storage: 'fridge', quantity: 2, opened: false, useBy: addDays(T, 2), dateSource: 'auto' });
    const saved = { sig: calendarSignature(s().items, T), lead: 2 };
    expect(s().freeze(item.id)).toBeTruthy();
    expect(calendarChanges(s().items, saved, 2, T).total).toBeGreaterThan(0);
  });
});

describe('eski kayıtlar ve yedek', () => {
  const legacy = {
    id: 'old1',
    catalogId: 'yogurt',
    name: 'Yoğurt',
    img: '🥣',
    category: 'sut',
    storage: 'fridge',
    quantity: 2,
    addedAt: addDays(T, -2),
    useBy: addDays(T, 12),
    opened: false,
    dateSource: 'package',
  };
  it('eski kayıt silinmeden yeni modele taşınır', () => {
    const [m] = migrateItems(cleanList([legacy], cleanItem).ok);
    expect(m!.useBy).toBe(legacy.useBy);
    expect(m!.quantity).toBe(2);
    expect(m!.baseUseBy).toBe(legacy.useBy);
    expect(m!.packageKind).toBe('unknown');
  });
  it('eski yemek kaydında pişirilme günü eklenme günüdür', () => {
    const [m] = migrateItems([{ ...legacy, category: 'yemek', dateSource: 'auto' } as FridgeItem]);
    expect(m!.cookedAt).toBe(legacy.addedAt);
  });
  it('yeni alanlar yedekten geri yüklenince korunur', () => {
    const full: FridgeItem = { ...(legacy as FridgeItem), unit: 'kutu', level: 'half', opened: true, openedAt: addDays(T, -1), boughtAt: addDays(T, -3), baseUseBy: addDays(T, 12), packageKind: 'stt', fromRecipe: true };
    const back = cleanItem(JSON.parse(JSON.stringify(full)));
    expect(back).toEqual(full);
    const shop = cleanShopping({ id: 's1', name: 'Süt', img: '🥛', category: 'sut', quantity: 2, unit: 'sise', done: false, addedAt: T });
    expect(shop?.unit).toBe('sise');
  });
  it('depoya yazılıp okununca kayıtlar korunur', async () => {
    s().add(yogurt(2));
    s().addShopping({ name: 'Süt', catalogId: 'sut', img: '🥛', category: 'sut', unit: 'sise' });
    const raw = localStorage.getItem('dolapta-ne-var');
    expect(raw).toBeTruthy();
    useFridge.setState({ items: [], shopping: [] });
    localStorage.setItem('dolapta-ne-var', raw!);
    await useFridge.persist.rehydrate();
    expect(s().items).toHaveLength(1);
    expect(s().shopping).toHaveLength(1);
  });
});

describe('gün değişimi', () => {
  it('kalan gün referans güne göre hesaplanır', () => {
    const { item } = s().add(yogurt());
    const it0 = s().items.find((i) => i.id === item.id)!;
    expect(daysLeft(it0, T)).toBe(14);
    expect(daysLeft(it0, addDays(T, 1))).toBe(13);
  });
});

describe('takvim iptali', () => {
  it('silinen ürünün hatırlatıcısı yeni dosyada iptal edilir', async () => {
    const { buildCalendar } = await import('../lib/calendar');
    const ics = buildCalendar([], 2, new Date(), [], ['eski-1']);
    expect(ics).toContain('UID:eski-1@dolapta-ne-var');
    expect(ics).toContain('STATUS:CANCELLED');
  });
});

describe('7. tur inceleme düzeltmeleri', () => {
  it('açılma günü bilinmeyen eski açık ürün, tarih düzenlenince açık ömrünü kaybetmez', () => {
    const [m] = migrateItems([{ id: 'o', catalogId: 'yogurt', name: 'Yoğurt', img: '🥣', category: 'sut', storage: 'fridge', quantity: 1, addedAt: addDays(T, -3), useBy: addDays(T, 1), opened: true, dateSource: 'auto' } as FridgeItem]);
    expect(m!.openedAt).toBe(addDays(T, -3));
    useFridge.setState({ items: [m!] });
    s().setDates('o', { boughtAt: T });
    expect(s().items[0]!.useBy).toBe(addDays(T, 1));
    s().setPackageDate('o', addDays(T, 10), 'stt');
    expect(s().items[0]!.useBy).toBe(addDays(T, 1));
  });
  it('örnek mutfaktaki açık ürünler açılma gününü taşır', () => {
    s().loadDemo();
    const open = s().items.filter((i) => i.opened);
    expect(open.length).toBeGreaterThan(0);
    open.forEach((i) => expect(i.openedAt).toBeTruthy());
    const y = open[0]!;
    s().setDates(y.id, { boughtAt: T });
    expect(diffDaysSafe(s().items.find((i) => i.id === y.id)!.useBy, y.useBy)).toBeLessThanOrEqual(0);
  });
  it('çözdürülen ürünün alınma günü değişince tarihi sıfırlanmaz', () => {
    const { item } = s().add({ catalogId: 'tavuk', name: 'Tavuk', img: '🍗', category: 'et', storage: 'freezer', quantity: 1, opened: false, useBy: addDays(T, 200), dateSource: 'auto', boughtAt: addDays(T, -40) });
    s().thaw(item.id);
    const before = s().items[0]!.useBy;
    s().setDates(item.id, { boughtAt: addDays(T, -41) });
    expect(s().items[0]!.useBy).toBe(before);
  });
  it('tariften artan yemekte pişirilme günü kadar kayar', () => {
    const { item } = s().add({ catalogId: 'ev-yemegi', name: 'Çoban Salata', img: '🥗', category: 'yemek', storage: 'fridge', quantity: 1, opened: false, useBy: addDays(T, 2), dateSource: 'auto', cookedAt: T, fromRecipe: true });
    s().setDates(item.id, { cookedAt: addDays(T, -1) });
    expect(s().items[0]!.useBy).toBe(addDays(T, 1));
  });
  it('elle girilen tarih, açılma günü düzenlenince korunur', () => {
    const { item } = s().add(yogurt());
    s().open(item.id);
    s().setManualDate(item.id, addDays(T, 10));
    s().setDates(item.id, { openedAt: T });
    expect(s().items[0]!.useBy).toBe(addDays(T, 10));
  });
  it('tarihi geçmişe çekilen ürün takvimde değişiklik sayılır ve iptal edilir', async () => {
    const { buildCalendar } = await import('../lib/calendar');
    const { item } = s().add(yogurt());
    const saved = { sig: calendarSignature(s().items, T), lead: 2 };
    s().setPackageDate(item.id, addDays(T, -1), 'stt');
    expect(calendarChanges(s().items, saved, 2, T).changed).toBe(1);
    const ics = buildCalendar(s().items, 2, new Date(), [], Object.keys(saved.sig));
    expect(ics).toContain(`UID:${item.id}@dolapta-ne-var`);
    expect(ics).toContain('STATUS:CANCELLED');
  });
  it('geri getir değişmiş satırın üstüne eklemez', () => {
    const { item } = s().add({ ...yogurt(2), catalogId: 'sut', name: 'Süt', img: '🥛', opened: true, openedAt: T, level: 'full' });
    const hid = s().finish(item.id, 'eaten', 1)!;
    s().update(item.id, { level: 'low' });
    s().revert(hid);
    expect(s().items).toHaveLength(2);
  });
  it('takvim dosyası: bitiş başlangıçtan sonra, CRLF ile biter', async () => {
    const { buildCalendar } = await import('../lib/calendar');
    s().add(yogurt());
    const ics = buildCalendar(s().items, 2, new Date(2026, 9, 28, 23, 54, 30));
    expect(ics.endsWith('\r\n')).toBe(true);
    const start = ics.match(/DTSTART:(\S+)/)![1]!;
    const end = ics.match(/DTEND:(\S+)/)![1]!;
    expect(end > start).toBe(true);
  });
});

function diffDaysSafe(a: string, b: string) {
  return (Date.parse(a) - Date.parse(b)) / 86400000;
}

describe('3x kontrol tur 1', () => {
  it('bitki sütleri kutu sütü gibi', async () => {
    const { guessCatalog } = await import('../data/catalog');
    for (const n of ['Badem sütü', 'Yulaf sütü', 'Soya sütü', 'Hindistan cevizi sütü']) expect(guessCatalog(n)?.item?.id).toBe('sut-uht');
  });
  it('dolaba alınan açık ürün, açılma günü değişince eski kiler tarihine dönmez', () => {
    const { item } = s().add({ catalogId: 'ceviz', name: 'Ceviz', img: 'ceviz', category: 'kuruyemis', storage: 'pantry', quantity: 1, opened: false, useBy: addDays(T, 85), dateSource: 'auto', addedAt: addDays(T, -5) });
    s().useSome(item.id);
    s().moveToFridge(item.id);
    const moved = s().items[0]!.useBy;
    s().setDates(item.id, { openedAt: addDays(T, -1) });
    expect(s().items[0]!.useBy).toBe(moved);
    expect(s().items[0]!.storage).toBe('fridge');
  });
  it('aynı alınma gününü yeniden girmek tarihi kaydırmaz', () => {
    const { item } = s().add({ catalogId: 'ananas', name: 'Ananas', img: '🍍', category: 'meyve', storage: 'counter', quantity: 1, opened: false, useBy: addDays(T, 1), dateSource: 'auto', addedAt: addDays(T, -2) });
    s().open(item.id);
    const before = s().items[0]!.useBy;
    s().setDates(item.id, { boughtAt: addDays(T, -2) });
    expect(s().items[0]!.useBy).toBe(before);
  });
  it('örnek mutfaktaki açık ürünlerin açılma günü kalan süreyle tutarlı', async () => {
    const { effectiveUseBy } = await import('../lib/freshness');
    s().loadDemo();
    s().items.filter((i) => i.opened).forEach((i) => expect(effectiveUseBy(i)).toBe(i.useBy));
  });
  it('alışveriş listesinde geri al, yerine geçilen alındı satırını geri getirir', () => {
    const a = s().addShopping({ name: 'Süt', catalogId: 'sut', img: '🥛', category: 'sut', unit: 'sise' });
    s().updateShopping(a.item.id, { done: true });
    const b = s().addShopping({ name: 'Süt', catalogId: 'sut', img: '🥛', category: 'sut', unit: 'sise' });
    s().undoShopping(b);
    expect(s().shopping.map((x) => [x.name, x.done])).toEqual([['Süt', true]]);
  });
});

describe('3x kontrol tur 2 (depo)', () => {
  it('aynı katalog kalemindeki farklı ürünler listede ayrı satır', () => {
    s().addShopping({ name: 'Maden suyu', catalogId: 'kola', img: '🥤', category: 'icecek', unit: 'sise' });
    const r = s().addShopping({ name: 'Kola', catalogId: 'kola', img: '🥤', category: 'icecek', unit: 'sise' });
    expect(r.existed).toBe(false);
    expect(s().shopping).toHaveLength(2);
  });
  it('aynı gün açılmış iki şişeden yalnızca biri azalır', () => {
    const { item } = s().add({ ...yogurt(2), catalogId: 'sut', name: 'Süt', img: '🥛', opened: true, openedAt: T, level: 'full' });
    s().useSome(item.id);
    expect(s().items.map((i) => [i.quantity, i.level]).sort()).toEqual([
      [1, 'full'],
      [1, 'half'],
    ]);
  });
});

describe('3x kontrol tur 3 (depo)', () => {
  it('bağlantısız ve bağlantılı aynı adlı ürün listede tek satır', () => {
    s().addShopping({ name: 'Organik süt', img: '🥛', category: 'sut', unit: 'sise' });
    const r = s().addShopping({ name: 'Organik süt', catalogId: 'sut', img: '🥛', category: 'sut', unit: 'sise' });
    expect(r.existed).toBe(true);
    expect(s().shopping).toHaveLength(1);
  });
  it('Az kaldı açık yığında biraz kullandım satır çoğaltmaz', () => {
    const { item } = s().add({ ...yogurt(2), catalogId: 'sut', name: 'Süt', img: '🥛', opened: true, openedAt: T, level: 'low' });
    s().useSome(item.id);
    expect(s().items).toHaveLength(1);
  });
});
