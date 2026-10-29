import { describe, expect, it } from 'vitest';
import { defaultStorage, guessCatalog } from '../data/catalog';
import { finishVerb, freezeAdvice } from './freshness';
import type { FridgeItem } from '../types';

describe('guessCatalog — 5. tur', () => {
  it('açılmış konserve buzdolabına', () => {
    expect(guessCatalog('Açılmış ton balığı')?.item?.id).toBe('konserve');
    expect(guessCatalog('açık mısır konservesi')?.item?.id).toBe('konserve');
    expect(guessCatalog('Ton balığı')?.item?.id).toBe('konserve-kapali');
  });
  it('X peyniri kendi türü', () => {
    expect(guessCatalog('Lor peyniri')?.item?.id).toBe('lor');
    expect(guessCatalog('Çökelek peyniri')?.item?.id).toBe('lor');
    expect(guessCatalog('Kaşar peyniri')?.item?.id).toBe('kasar');
    expect(guessCatalog('Ezine peyniri')?.item?.id).toBe('beyaz-peynir');
  });
  it('-li atıştırmalık yemek sayılmaz', () => {
    expect(guessCatalog('sütlü çikolata')?.category).toBe('atistirmalik');
    expect(guessCatalog('meyveli yoğurt')?.category).toBe('sut');
    expect(guessCatalog('peynirli börek')?.category).toBe('yemek');
  });
});

describe('guessCatalog — gıda güvenliği turu', () => {
  const g = (n: string) => guessCatalog(n);
  it('bal kabağı bal değildir', () => {
    expect(g('Bal kabağı')?.item?.id).toBe('bal-kabagi');
    expect(g('balkabağı')?.item?.id).toBe('bal-kabagi');
    expect(g('Bal')?.item?.id).toBe('bal');
    expect(g('Bal kabağı çekirdeği')?.item?.id).toBe('cekirdek');
    expect(g('Bal kabağı tatlısı')?.category).toBe('yemek');
  });
  it('donuk hazır ürünler dondurucuda', () => {
    for (const n of ['Donuk köfte', 'Dondurulmuş börek', 'donuk mantı']) {
      expect(g(n)?.category, n).toBe('donuk');
      expect(g(n)?.item, n).toBeUndefined();
    }
    expect(g('Donuk bezelye')?.item?.id).toBe('donuk-sebze');
    expect(g('Dondurma')?.item?.id).toBe('dondurma');
  });
  it('süt/pasta kreması sos değildir', () => {
    expect(g('Süt kreması')?.item?.id).toBe('krema');
    expect(g('Pasta kreması')?.item?.id).toBe('tatli');
    expect(g('Krem şanti')?.item?.id).toBe('krema');
    expect(g('Fındık kreması')?.item?.id).toBe('findik-kremasi');
    for (const n of ['Süt kreması', 'Pasta kreması']) expect(g(n)?.item?.days.pantry, n).toBeUndefined();
  });
  it('pişmiş yumurta yemekleri', () => {
    for (const n of ['Kayısı yumurta', 'Lop yumurta', 'Rafadan', 'Sahanda yumurta', 'Çılbır', 'Omlet', 'Menemen']) expect(g(n)?.category, n).toBe('yemek');
    expect(g('Haşlanmış yumurta')?.item?.id).toBe('haslanmis-yumurta');
    expect(g('Yumurta')?.item?.id).toBe('yumurta');
  });
  it('sakatat', () => {
    for (const n of ['Kuzu ciğeri', 'Dana böbrek', 'İşkembe', 'Tavuk ciğeri', 'Kokoreç', 'Ciğer']) expect(g(n)?.item?.id, n).toBe('sakatat');
    expect(g('Kuzu pirzola')?.item?.id).toBe('kirmizi-et');
    expect(g('İşkembe çorbası')?.category).toBe('yemek');
  });
  it('pişmiş pirinç pilavdır', () => {
    expect(g('Haşlanmış pirinç')?.item?.id).toBe('pilav');
    expect(g('Artan pilav')?.item?.id).toBe('pilav');
    expect(g('Pirinç')?.item?.id).toBe('pirinc');
  });
  it('çiğ süt', () => {
    expect(g('Çiğ süt')?.item?.id).toBe('cig-sut');
    expect(g('Köy sütü')?.item?.id).toBe('cig-sut');
    expect(g('Çiğ süt')?.item?.tip).toContain('kaynat');
    expect(g('Çiğ süt peyniri')?.item?.id).toBe('lor');
  });
  it('hazır bebek maması sıvıdır', () => {
    expect(g('Hazır bebek maması')?.item?.id).toBe('hazir-mama');
    expect(g('Bebek maması')?.item?.id).toBe('bebek-mamasi');
  });
  it('dolmalık / çam fıstığı kuruyemiş', () => {
    expect(g('Dolmalık fıstık')?.item?.id).toBe('cam-fistigi');
    expect(g('Çam fıstığı')?.item?.id).toBe('cam-fistigi');
    expect(g('Dolmalık biber')?.item?.id).toBe('biber');
    expect(g('Biber dolması')?.category).toBe('yemek');
    expect(g('Tuzlu fıstığı')?.category).toBe('kuruyemis');
  });
  it('kuru meyveler', () => {
    for (const n of ['Dut kurusu', 'İncir kurusu', 'Kuru dut', 'Kuru incir', 'Erik kurusu', 'Elma kurusu']) expect(g(n)?.item?.id, n).toBe('kuru-meyve');
    expect(g('Kayısı kurusu')?.item?.id).toBe('kuru-kayisi');
    expect(g('Kuru kayısı')?.item?.id).toBe('kuru-kayisi');
    expect(g('Kuru üzüm')?.item?.id).toBe('kuru-uzum');
    expect(g('Kuru biber')?.item?.id).toBe('kurutmalik');
  });
  it('salamura yaprak, yarma, sumak, limon tuzu, çökelek', () => {
    expect(g('Salamura yaprak')?.item?.id).toBe('salamura-yaprak');
    expect(g('Asma yaprağı')?.item?.id).toBe('salamura-yaprak');
    expect(g('Yaprak sarma')?.item?.id).toBe('sarma');
    expect(g('Yarma')?.item?.id).toBe('yarma');
    expect(g('Dövme')?.item?.id).toBe('yarma');
    expect(g('Sumak')?.item?.id).toBe('baharat');
    expect(g('Limon tuzu')?.item?.id).toBe('baharat');
    expect(g('Limon')?.item?.id).toBe('limon');
    expect(g('Çökelek')?.item?.id).toBe('lor');
  });
  it('açılmış kuru gıda 3 günlük olmaz; makarna kurudur', () => {
    for (const [n, id] of [['Açılmış pirinç', 'pirinc'], ['Açılmış ceviz', 'ceviz'], ['Açılmış makarna', 'kuru-makarna']] as const) {
      expect(g(n)?.item?.id, n).toBe(id);
      expect(g(n)?.opened, n).toBeFalsy();
    }
    for (const n of ['Makarna', '2 paket makarna', 'Barilla makarna']) expect(g(n)?.item?.id, n).toBe('kuru-makarna');
    expect(g('Haşlanmış makarna')?.item?.id).toBe('makarna');
    expect(g('Artan makarna')?.item?.id).toBe('makarna');
    // Açılma süresi tanımlı olanlar açılmış kalır.
    expect(g('Açılmış uzun ömürlü süt')?.opened).toBe(true);
    expect(g('Kesilmiş kavun')?.opened).toBe(true);
    expect(g('Kesilmiş bal kabağı')?.opened).toBe(true);
  });
  it('kabartma tozu ve karbonat maya değildir', () => {
    expect(g('Kabartma tozu')?.item?.id).toBe('kabartma');
    expect(g('Karbonat')?.item?.id).toBe('kabartma');
    expect(g('Soda bikarbonat')?.item?.id).toBe('kabartma');
    expect(g('Kuru maya')?.item?.id).toBe('maya');
  });
  it('bebek yoğurdu yoğurt görseli alır', () => {
    expect(g('Bebek yoğurdu')?.item?.id).toBe('yogurt');
    expect(g('Bebek yoğurdu')?.item?.img).toBe('🥣');
  });
  it('bal kabağının varsayılan yeri buzdolabı', () => {
    const c = g('Bal kabağı')!.item!;
    expect(defaultStorage(c)).toBe('fridge');
  });
});

describe('finishVerb ve dondurma önerisi', () => {
  const item = (o: Partial<FridgeItem>) => ({ id: '1', name: 'x', img: '🍎', category: 'meyve', storage: 'fridge', quantity: 1, addedAt: '2026-10-20', useBy: '2026-10-26', ...o }) as FridgeItem;
  it('pişirilen sebzede Kullandım', () => {
    expect(finishVerb({ category: 'sebze', catalogId: 'patlican' })).toBe('Kullandım');
    expect(finishVerb({ category: 'sebze', catalogId: 'bal-kabagi' })).toBe('Kullandım');
    expect(finishVerb({ category: 'sebze', catalogId: 'domates' })).toBe('Yedim');
    expect(finishVerb({ category: 'sebze' })).toBe('Yedim');
    expect(finishVerb({ category: 'meyve' })).toBe('Yedim');
  });
  it('meyvede yemeyeceksen', () => {
    expect(freezeAdvice(item({ category: 'meyve', catalogId: 'kiraz' }), '2026-10-26')).toContain('yemeyeceksen');
    expect(freezeAdvice(item({ category: 'et', catalogId: 'kiyma' }), '2026-10-26')).toContain('pişirmeyeceksen');
  });
});

describe('guessCatalog — 6. tur', () => {
  it('pişmiş makarna/yumurta yemekleri kuru gıda değil', () => {
    expect(guessCatalog('kıymalı makarna')?.category).toBe('yemek');
    expect(guessCatalog('soslu makarna')?.category).toBe('yemek');
    expect(guessCatalog('sebzeli bulgur')?.category).toBe('yemek');
    expect(guessCatalog('sucuklu yumurta')?.category).toBe('yemek');
    expect(guessCatalog('makarna haşladım')?.category).toBe('yemek');
    expect(guessCatalog('sütlü çikolata')?.category).toBe('atistirmalik');
  });
  it('taze sıkma meyve suyu kilerde durmaz', () => {
    expect(guessCatalog('Taze sıkılmış portakal suyu')?.item?.id).toBe('taze-sikma');
    expect(guessCatalog('sıkma portakal suyu')?.item?.id).toBe('taze-sikma');
    expect(guessCatalog('portakal suyu')?.item?.id).toBe('meyve-suyu');
  });
  it('diğer düzeltmeler', () => {
    expect(guessCatalog('mısır cipsi')?.item?.id).toBe('cips');
    expect(guessCatalog('taze makarna')?.item?.id).toBe('taze-makarna');
    expect(guessCatalog('Ev konservesi')?.item?.id).toBe('ev-konservesi');
    expect(guessCatalog('tam buğday makarna')?.item?.id).not.toBe('tam-bugday-unu');
  });
});

describe('guessCatalog — 6. tur (2)', () => {
  it('ayran, kola, hellim', () => {
    expect(guessCatalog('ayran')?.item?.id).toBe('ayran');
    expect(guessCatalog('Coca Cola 1 L')?.item?.id).toBe('kola');
    expect(guessCatalog('Hellim')?.item?.id).toBe('beyaz-peynir');
  });
});

describe('3x kontrol tur 2', () => {
  it('açılmış baş isimler açık kalır', () => {
    expect(guessCatalog('Açılmış badem sütü')?.opened).toBe(true);
    expect(guessCatalog('Açık domates salçası')?.opened).toBe(true);
    expect(guessCatalog('Açılmış kaşar peyniri')?.opened).toBe(true);
  });
  it('dondurma ve fırın yemekleri', () => {
    expect(guessCatalog('Vanilyalı dondurma')?.item?.id).toBe('dondurma');
    expect(guessCatalog('Fırın makarna')?.category).toBe('yemek');
    expect(guessCatalog('Fırın tavuk')?.category).toBe('yemek');
  });
});

describe('3x kontrol tur 3', () => {
  it('fırın ürünleri yemek sayılmaz', () => {
    for (const n of ['fırın poğaça', 'fırın kek', 'fırın simidi', 'fırın ekmeği', 'fırın tost ekmeği', 'fırın lavaş']) expect(guessCatalog(n)?.category).toBe('firin');
    expect(guessCatalog('fırın makarna')?.category).toBe('yemek');
    expect(guessCatalog('fırında tavuk')?.category).toBe('yemek');
  });
  it('kalan/artan pişmeyen ürünler', () => {
    expect(guessCatalog('kalan süt')?.item?.id).toBe('sut');
    expect(guessCatalog('artan ekmek')?.category).toBe('firin');
    expect(guessCatalog('kalan pilav')?.category).toBe('yemek');
    expect(guessCatalog('dünkü çorba')?.category).toBe('yemek');
  });
});
