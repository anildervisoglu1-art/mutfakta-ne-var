import { CATALOG, getCatalogItem } from '../data/catalog';
import { RECIPES } from '../data/recipes';
import { addDays, diffDays, relativeDay } from './dates';
import { canFreeze, freezeWorthIt, suggestUseBy, untilPhrase, urgency, urgencyTitle, useByAfterOpening } from './freshness';
import { cleanItem } from './validate';
import { findExact, guessCatalog, guessCategory, CATALOG as CAT, queryScore, searchKey } from '../data/catalog';
import { suggestRecipes } from './suggest';
import { buildCalendar } from './calendar';
import { emojiToStem } from './images';
import type { FridgeItem } from '../types';

const REF = '2026-10-26'; // Pazartesi

const item = (over: Partial<FridgeItem>): FridgeItem => ({
  id: 'x',
  name: 'Test',
  img: '🍎',
  category: 'meyve',
  storage: 'fridge',
  quantity: 1,
  addedAt: REF,
  useBy: addDays(REF, 5),
  opened: false,
  dateSource: 'auto',
  ...over,
});

describe('tarihler', () => {
  it('ay ve yaz saati geçişlerinde gün farkını doğru hesaplar', () => {
    expect(diffDays('2026-11-01', '2026-10-25')).toBe(7);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });
  it('göreli gün adı', () => {
    expect(relativeDay(REF, REF)).toBe('Bugün');
    expect(relativeDay('2026-10-27', REF)).toBe('Yarın');
    expect(relativeDay('2026-10-30', REF)).toBe('Cuma');
    expect(relativeDay('2026-11-10', REF)).toBe('10 Kas');
  });
});

describe('tazelik', () => {
  it('uyarı bozulma gününden önce gelir', () => {
    const elma = item({ useBy: addDays(REF, 28) });
    expect(urgency(elma, 2, REF)).toBe('fresh');
    expect(urgency(elma, 2, addDays(REF, 26))).toBe('soon');
    expect(urgency(elma, 2, addDays(REF, 28))).toBe('today');
    expect(urgency(elma, 2, addDays(REF, 29))).toBe('expired');
  });
  it('aynı gün kalan ürünler aynı aciliyette görünür', () => {
    const tavuk = item({ useBy: addDays(REF, 2), addedAt: REF });
    const elma = item({ useBy: addDays(REF, 2), addedAt: addDays(REF, -26) });
    expect(urgency(tavuk, 2, REF)).toBe('soon');
    expect(urgency(elma, 2, REF)).toBe(urgency(tavuk, 2, REF));
    expect(urgency(tavuk, 1, REF)).toBe('fresh');
  });
  it('tarihi geçmiş ürün dondurulamaz', () => {
    expect(canFreeze(item({ catalogId: 'tavuk', category: 'et', useBy: addDays(REF, -1) }), REF)).toBe(false);
    expect(canFreeze(item({ catalogId: 'tavuk', category: 'et', useBy: addDays(REF, 1) }), REF)).toBe(true);
  });
  it('doğal Türkçe tarih ifadesi', () => {
    expect(untilPhrase('2026-10-30', REF)).toBe("Cuma'ya kadar");
    expect(untilPhrase('2026-11-19', REF)).toBe("19\u00a0Kasım'a kadar");
  });
  it('başlıklar anlaşılır', () => {
    expect(urgencyTitle(item({ useBy: addDays(REF, 1) }), 2, REF)).toBe('Yarın son gün');
    expect(urgencyTitle(item({ useBy: REF }), 2, REF)).toBe('Bugün son gün');
    expect(urgencyTitle(item({ useBy: addDays(REF, 2) }), 2, REF)).toBe('2 gün kaldı');
  });
  it('açılınca süre kısalır, asla uzamaz', () => {
    const sut = getCatalogItem('sut')!;
    expect(suggestUseBy(sut, 'fridge', true, REF)).toBe(addDays(REF, sut.opened!));
    const i = item({ catalogId: 'sut', useBy: addDays(REF, 1) });
    expect(useByAfterOpening(i, REF)).toBe(addDays(REF, 1));
  });
});

describe('katalog', () => {
  it('her ürünün benzersiz kimliği ve en az bir saklama süresi var', () => {
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length);
    for (const c of CATALOG) {
      expect(Object.keys(c.days).length).toBeGreaterThan(0);
      for (const d of Object.values(c.days)) expect(d).toBeGreaterThan(0);
      if (c.opened !== undefined) expect(c.opened).toBeLessThanOrEqual(Math.max(...Object.values(c.days)));
    }
  });
  it('tarif ve ürün kimlikleri benzersiz', () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });
  it('arama önce tam adı getirir', () => {
    const top = (q: string) => [...CAT].sort((a, b) => queryScore(b, searchKey(q)) - queryScore(a, searchKey(q)))[0]!.id;
    expect(top('un')).toBe('un');
    expect(top('pirinç')).toBe('pirinc');
    expect(top('mercimek')).toBe('mercimek');
  });
  it('tarif malzemeleri katalogda var', () => {
    for (const r of RECIPES) for (const n of r.needs.flat()) expect(getCatalogItem(n), `${r.id}: ${n}`).toBeDefined();
  });
  it('emoji dosya adı', () => {
    expect(emojiToStem('🌶️')).toBe('1f336');
    expect(emojiToStem('🍎')).toBe('1f34e');
  });
});

describe('öneriler ve takvim', () => {
  it('bugün bitmesi gereken ürünü kullanan tarif önde', () => {
    const items = [
      item({ id: 'a', catalogId: 'ispanak', useBy: REF }),
      item({ id: 'b', catalogId: 'yumurta', useBy: addDays(REF, 20) }),
      item({ id: 'c', catalogId: 'sogan', useBy: addDays(REF, 20) }),
      item({ id: 'd', catalogId: 'muz', useBy: addDays(REF, 20) }),
      item({ id: 'e', catalogId: 'sut', useBy: addDays(REF, 20) }),
    ];
    const s = suggestRecipes(items, 2, REF);
    expect(s[0]!.uses.some((u) => u.catalogId === 'ispanak')).toBe(true);
  });
  it('takvim dosyası uyarı gününe hatırlatıcı koyar', () => {
    const ics = buildCalendar([item({ id: 'k', name: 'Kıyma', useBy: '2099-01-10', addedAt: '2099-01-01' })], 2);
    expect(ics).toContain('DTSTART:20990108T090000');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('UID:k@dolapta-ne-var');
  });
  it('takvim metni kaçışlı ve satırlar 75 baytı geçmez', () => {
    const ics = buildCalendar([item({ id: 'z', name: 'a\\b; çok uzun ışıklı şöğüç adlı ürün, gerçekten çok çok uzun bir isim', useBy: '2099-01-10' })], 2);
    expect(ics).toContain('a\\\\b\\;');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe('veri doğrulama ve özel ürünler', () => {
  it('bozuk kayıtları ayıklar', () => {
    expect(cleanItem({ id: 'z', name: 'Bozuk' })).toBeUndefined();
    expect(cleanItem(null)).toBeUndefined();
    const ok = cleanItem({ id: 'a', name: 'Süt', category: 'sut', storage: 'fridge', useBy: '2026-11-01', addedAt: '2026-10-26', quantity: '3' });
    expect(ok?.quantity).toBe(3);
    expect(cleanItem({ id: 'a', name: 'X', category: 'sut', storage: 'fridge', useBy: '2026-02-31', addedAt: '2026-10-26' })).toBeUndefined();
  });
  it('kategori tahmini ve katalog eşleşmesi', () => {
    expect(guessCategory('kuru fasulye yemeği')).toBe('yemek');
    expect(guessCategory('kuru fasulye')).toBe('kuru');
    expect(guessCategory('Sushi')).toBe('et');
    expect(guessCategory('Lahmacun')).toBe('yemek');
    expect(guessCategory('Ton balığı')).toBe('sos');
    // Panelin bulduğu tehlikeli tahminler: pişmiş/kesilmiş adlar ham ürünün süresini almamalı.
    const g = (n: string) => guessCatalog(n);
    expect(g('Haşlanmış nohut')?.category).toBe('yemek');
    expect(g('Haşlanmış nohut')?.item).toBeUndefined();
    expect(g('Elma püresi')?.item?.id).toBe('meyve-puresi');
    expect(g('Patates püresi')?.item?.id).toBe('meyve-puresi');
    expect(g('Kesilmiş kavun')?.opened).toBe(true);
    expect(g('Bulgur salatası')?.category).toBe('yemek');
    expect(g('Haşlanmış yumurta')?.item?.id).toBe('haslanmis-yumurta');
    expect(g('Bebek yoğurdu')?.category).toBe('sut');
    expect(g('Kuru biber')?.item?.id).toBe('kurutmalik');
    expect(g('Hazır çorba')?.item?.id).toBe('hazir-corba');
    expect(g('Kemik suyu')?.item?.id).toBe('corba');
    expect(g('Mısır konservesi')?.item?.id).toBe('konserve-kapali');
    expect(g('Kabak çekirdeği')?.item?.id).toBe('cekirdek');
    expect(g('Midye dolma')?.item?.id).toBe('midye');
    expect(g('Peynirli börek')?.category).toBe('yemek');
    expect(g('Tuzlu fıstık')?.category).toBe('kuruyemis');
    expect(g('Tarhana')?.item?.id).toBe('tarhana');
    // 4. tur: bozulabilir türler kuru gıda kurallarından önce gelir.
    const cat = (n: string) => g(n)?.category;
    for (const n of ['Paket kıyma', 'Paket tavuk', 'Hazır köfte', 'Hazır salata', 'Kutu krema', 'Paket yoğurt', 'Kuru köfte', 'Kuru patlıcan dolması', 'Nohut haşlaması'])
      expect(['kuru', 'kuruyemis', 'temel', 'atistirmalik'], n).not.toContain(cat(n));
    expect(g('Karpuz dilimi')?.opened).toBe(true);
    expect(g('Hazırlanmış mama')?.item?.id).toBe('hazir-mama');
    expect(g('Vişne reçeli')?.item?.id).toBe('recel');
    expect(g('Üzüm pekmezi')?.item?.id).toBe('pekmez');
    expect(g('Nar ekşisi')?.item?.id).toBe('nar-eksisi');
    expect(g('Lahana turşusu')?.item?.id).toBe('tursu');
    expect(g('Su böreği')?.item?.id).toBe('borek');
    expect(g('Tam yağlı yoğurt')?.item?.id).toBe('yogurt');
    expect(g('Yarım paket makarna')?.opened).toBeFalsy();
    expect(cat('Bebek bisküvisi')).toBe('atistirmalik');
    expect(cat('Kavrulmuş fındık')).toBe('kuruyemis');
    expect(g('Bal kabağı çekirdeği')?.item?.id).toBe('cekirdek');
    expect(cat('Jelibon')).toBe('atistirmalik');
    expect(guessCategory('Balkabağı')).toBe('sebze');
    expect(guessCategory('Fındık ezmesi')).toBe('sos');
    expect(guessCategory('Baldo pirinç')).toBe('kuru');
    expect(guessCatalog('Hummus ev yapımı')?.category).toBe('yemek');
    expect(findExact('ıspanak')?.id).toBe('ispanak');
    expect(findExact('Hummus')?.id).toBe('humus');
  });
  it('yalnızca domates-biber-yumurta varken ana malzemesi eksik tarif önerilmez', () => {
    const items = ['domates', 'biber', 'yumurta'].map((c, i) => item({ id: String(i), catalogId: c, useBy: addDays(REF, 3) }));
    const ids = suggestRecipes(items, 2, REF).map((s) => s.recipe.id);
    expect(ids).toContain('menemen');
    expect(ids).not.toContain('tavuk-sote');
    expect(ids).not.toContain('karniyarik');
  });
});

describe('dondurucu seçeneği', () => {
  it('her üründe ve her özel kategoride dondurucu seçeneği var; donunca kısalmaz', () => {
    for (const c of CATALOG) {
      expect(c.days.freezer, c.id).toBeGreaterThan(0);
      expect(c.days.freezer!, c.id).toBeGreaterThanOrEqual(Math.max(...Object.values(c.days)));
    }
  });
  it('dokusu bozulan üründe dondurulabilir ama "dondur" önerilmez', () => {
    const marul = item({ catalogId: 'marul', category: 'sebze', useBy: addDays(REF, 1) });
    expect(canFreeze(marul, REF)).toBe(true);
    expect(freezeWorthIt(marul, REF)).toBe(false);
    expect(freezeWorthIt(item({ catalogId: 'kek', category: 'firin', useBy: addDays(REF, 1) }), REF)).toBe(true);
  });
});
