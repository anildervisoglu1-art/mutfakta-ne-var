import type { CatalogItem, Category, CategoryId, StorageId } from '../types';

/**
 * Kategoriler. `img` kategori görselidir (özel ürün eklerken de kullanılır).
 * Renkler `tokens.css` içindeki --cat-* değişkenleriyle eşleşir.
 */
export const CATEGORIES: Category[] = [
  { id: 'meyve', name: 'Meyve', img: '🍎' },
  { id: 'sebze', name: 'Sebze & Yeşillik', img: '🥕' },
  { id: 'sut', name: 'Süt & Kahvaltılık', img: '🧀' },
  { id: 'et', name: 'Et, Tavuk & Balık', img: '🥩' },
  { id: 'yemek', name: 'Ev Yemeği', img: '🥘' },
  { id: 'firin', name: 'Ekmek & Fırın', img: '🍞' },
  { id: 'icecek', name: 'İçecek', img: '🧃' },
  { id: 'sos', name: 'Sos & Kavanoz', img: '🫙' },
  { id: 'kuru', name: 'Bakliyat & Tahıl', img: '🌾' },
  { id: 'kuruyemis', name: 'Kuruyemiş & Kuru Meyve', img: '🥜' },
  { id: 'temel', name: 'Yağ, Çay & Baharat', img: '🫗' },
  { id: 'atistirmalik', name: 'Atıştırmalık & Tatlı', img: '🍪' },
  { id: 'donuk', name: 'Dondurulmuş', img: '🧊' },
];

/** Açılınca/kesilince oda sıcaklığında bekletilmemesi gereken kategoriler. */
export const PERISHABLE: ReadonlySet<CategoryId> = new Set<CategoryId>(['meyve', 'sebze', 'sut', 'et', 'yemek', 'firin', 'icecek', 'sos']);

export const STORAGES: { id: StorageId; name: string; short: string }[] = [
  { id: 'fridge', name: 'Buzdolabı', short: 'Buzdolabı' },
  { id: 'freezer', name: 'Dondurucu', short: 'Dondurucu' },
  { id: 'counter', name: 'Tezgâh', short: 'Tezgâh' },
  { id: 'pantry', name: 'Kiler', short: 'Kiler' },
];

/**
 * Ürün kataloğu.
 * `days`: aldıktan (ya da pişirdikten) sonra o yerde kaç gün içinde tüketilmesi önerilir.
 *   fridge = buzdolabı, freezer = dondurucu, counter = tezgâh (meyve kâsesi, ekmeklik), pantry = kiler / mutfak dolabı (kuru, serin, karanlık).
 * `opened`: paket açıldıktan / kesildikten sonra kalan gün (varsa).
 * Süreler genel gıda güvenliği önerilerine göre temkinli seçildi; paketteki tarih her zaman önceliklidir.
 */
export const CATALOG: CatalogItem[] = [
  // — Meyve —
  { id: 'elma', name: 'Elma', img: '🍎', category: 'meyve', days: { fridge: 28, counter: 7 }, tip: 'Diğer meyvelerden ayrı sakla; yaydığı gaz onları hızlı olgunlaştırır.' },
  { id: 'yesil-elma', name: 'Yeşil Elma', img: '🍏', category: 'meyve', days: { fridge: 28, counter: 7 } },
  { id: 'armut', name: 'Armut', img: '🍐', category: 'meyve', days: { fridge: 7, counter: 4 } },
  { id: 'muz', name: 'Muz', img: '🍌', category: 'meyve', days: { counter: 5, freezer: 60 }, tip: 'Buzdolabında kabuğu kararır. Çok olgunlaştıysa soyup dondur; smoothie ya da kekte kullan.' },
  { id: 'portakal', name: 'Portakal', img: '🍊', category: 'meyve', days: { fridge: 21, counter: 7 } },
  { id: 'mandalina', name: 'Mandalina', img: '🍊', category: 'meyve', days: { fridge: 14, counter: 7 } },
  { id: 'limon', name: 'Limon', img: '🍋', category: 'meyve', days: { fridge: 28, counter: 7 }, opened: 5, tip: 'Kesilen yarımı ters çevirip küçük bir tabakta sakla.' },
  { id: 'cilek', name: 'Çilek', img: '🍓', category: 'meyve', days: { fridge: 3, freezer: 180 }, tip: 'Yemeden hemen önce yıka; ıslak saklanınca çabuk küflenir.' },
  { id: 'uzum', name: 'Üzüm', img: '🍇', category: 'meyve', days: { fridge: 7 } },
  { id: 'kiraz', name: 'Kiraz', img: '🍒', category: 'meyve', days: { fridge: 5, freezer: 180 } },
  { id: 'seftali', name: 'Şeftali', img: '🍑', category: 'meyve', days: { fridge: 5, counter: 3 } },
  { id: 'yaban-mersini', name: 'Yaban Mersini', img: '🫐', category: 'meyve', days: { fridge: 7, freezer: 180 } },
  { id: 'kivi', name: 'Kivi', img: '🥝', category: 'meyve', days: { fridge: 14, counter: 5 } },
  { id: 'karpuz', name: 'Karpuz', img: '🍉', category: 'meyve', days: { counter: 10, fridge: 10 }, opened: 3, tip: 'Kesilen karpuzun yüzünü streç filmle kapat.' },
  { id: 'kavun', name: 'Kavun', img: '🍈', category: 'meyve', days: { counter: 7, fridge: 7 }, opened: 3 },
  { id: 'ananas', name: 'Ananas', img: '🍍', category: 'meyve', days: { counter: 3, fridge: 5 }, opened: 3 },
  { id: 'mango', name: 'Mango', img: '🥭', category: 'meyve', days: { counter: 4, fridge: 5 }, opened: 2 },
  { id: 'avokado', name: 'Avokado', img: '🥑', category: 'meyve', days: { counter: 4, fridge: 4 }, opened: 1, tip: 'Sertse tezgâhta olgunlaştır, olgunlaşınca dolaba al. Kesik yüzüne limon sür.' },
  { id: 'nar', name: 'Nar', img: 'nar', category: 'meyve', days: { fridge: 30, counter: 14 }, opened: 4, tip: 'Taneleri ayıklanmış narı kapalı kapta dolapta sakla; 4–5 gün içinde ye ya da dondur.' },
  { id: 'ayva', name: 'Ayva', img: '🍐', category: 'meyve', days: { counter: 14, fridge: 30 } },
  { id: 'kestane', name: 'Kestane', img: '🌰', category: 'meyve', days: { fridge: 14, counter: 5, freezer: 180 }, tip: 'Taze kestane nem kaybedip küflenebilir; delikli torbada dolapta sakla.' },

  // — Sebze & Yeşillik —
  { id: 'domates', name: 'Domates', img: '🍅', category: 'sebze', days: { fridge: 7, counter: 5, freezer: 240 }, keywords: ['çeri'], tip: 'Kışlık için rendeleyip küçük kaplarda dondurabilirsin.' },
  { id: 'salatalik', name: 'Salatalık', img: '🥒', category: 'sebze', days: { fridge: 5 } },
  { id: 'kabak', name: 'Kabak', img: '🥒', category: 'sebze', days: { fridge: 5 } },
  { id: 'biber', name: 'Biber', img: '🫑', category: 'sebze', days: { fridge: 7, freezer: 240 }, keywords: ['sivri', 'sivri biber', 'dolmalık', 'dolmalık biber', 'kapya', 'çarliston'] },
  { id: 'aci-biber', name: 'Acı Biber', img: '🌶️', category: 'sebze', days: { fridge: 10 } },
  { id: 'patlican', name: 'Patlıcan', img: '🍆', category: 'sebze', days: { fridge: 5, freezer: 240 }, tip: 'Közleyip soyduktan sonra porsiyonlayıp dondurabilirsin.' },
  { id: 'marul', name: 'Marul', img: '🥬', category: 'sebze', days: { fridge: 5 }, tip: 'Kâğıt havluya sarıp kapalı kapta sakla, daha uzun canlı kalır.' },
  { id: 'ispanak', name: 'Ispanak', img: '🥬', category: 'sebze', days: { fridge: 4, freezer: 240 } },
  { id: 'lahana', name: 'Lahana', img: '🥬', category: 'sebze', days: { fridge: 14 }, opened: 4 },
  { id: 'maydanoz', name: 'Maydanoz', img: '🌿', category: 'sebze', days: { fridge: 6 }, tip: 'Saplarını bir bardak suya koy, üstünü poşetle gevşekçe ört.' },
  { id: 'dereotu', name: 'Dereotu', img: '🌿', category: 'sebze', days: { fridge: 5 } },
  { id: 'nane', name: 'Taze Nane', img: '🌿', category: 'sebze', days: { fridge: 6 } },
  { id: 'roka', name: 'Roka', img: '🌿', category: 'sebze', days: { fridge: 3 } },
  { id: 'brokoli', name: 'Brokoli', img: '🥦', category: 'sebze', days: { fridge: 5, freezer: 300 } },
  { id: 'karnabahar', name: 'Karnabahar', img: '🥦', category: 'sebze', days: { fridge: 5, freezer: 300 } },
  { id: 'havuc', name: 'Havuç', img: '🥕', category: 'sebze', days: { fridge: 21 } },
  { id: 'mantar', name: 'Mantar', img: 'mantar', category: 'sebze', days: { fridge: 5 }, tip: 'Plastik yerine kâğıt torbada sakla; nemden çabuk kayganlaşır.' },
  { id: 'sogan', name: 'Soğan', img: '🧅', category: 'sebze', days: { pantry: 30, fridge: 30 }, opened: 7, keywords: ['kuru soğan', 'kırmızı soğan', 'arpacık'] },
  { id: 'sarimsak', name: 'Sarımsak', img: '🧄', category: 'sebze', days: { pantry: 60 } },
  { id: 'patates', name: 'Patates', img: '🥔', category: 'sebze', days: { pantry: 30 }, tip: 'Serin ve karanlık yerde, soğandan ayrı sakla.' },
  { id: 'misir', name: 'Mısır', img: '🌽', category: 'sebze', days: { fridge: 3, freezer: 240 } },
  { id: 'bezelye', name: 'Bezelye', img: '🫛', category: 'sebze', days: { fridge: 5, freezer: 240 } },
  { id: 'taze-fasulye', name: 'Taze Fasulye', img: '🫛', category: 'sebze', days: { fridge: 5, freezer: 240 } },
  { id: 'zencefil', name: 'Zencefil', img: '🫚', category: 'sebze', days: { fridge: 21, freezer: 180 } },
  { id: 'pirasa', name: 'Pırasa', img: '🥬', category: 'sebze', days: { fridge: 10, freezer: 240 } },
  { id: 'kereviz', name: 'Kereviz', img: '🥬', category: 'sebze', days: { fridge: 14, freezer: 240 }, keywords: ['kök kereviz', 'sap kereviz'] },
  { id: 'turp', name: 'Turp', img: '🥕', category: 'sebze', days: { fridge: 10 }, keywords: ['kırmızı turp', 'siyah turp'] },
  { id: 'pazi', name: 'Pazı', img: '🥬', category: 'sebze', days: { fridge: 4, freezer: 240 } },
  { id: 'semizotu', name: 'Semizotu', img: '🌿', category: 'sebze', days: { fridge: 3 } },
  { id: 'bamya', name: 'Bamya', img: '🫛', category: 'sebze', days: { fridge: 3, freezer: 240 } },
  { id: 'taze-sogan', name: 'Taze Soğan', img: '🌿', category: 'sebze', days: { fridge: 7 } },
  { id: 'bal-kabagi', name: 'Bal Kabağı', img: '🥕', category: 'sebze', days: { fridge: 7, counter: 30, freezer: 240 }, opened: 5, keywords: ['balkabağı', 'helvacı kabağı', 'kestane kabağı'], tip: 'Bütün ve kesilmemiş kabak serin bir yerde haftalarca durur; kesilen dilimi streçleyip dolapta sakla, 4–5 gün içinde pişir ya da doğrayıp dondur.' },

  // — Süt & Kahvaltılık —
  { id: 'sut', name: 'Süt', img: '🥛', category: 'sut', days: { fridge: 5 }, opened: 3, keywords: ['günlük süt', 'pastörize'] },
  { id: 'cig-sut', name: 'Çiğ Süt', img: '🥛', category: 'sut', days: { fridge: 3 }, keywords: ['köy sütü', 'açık süt', 'sağım sütü'], tip: 'Çiğ sütü kaynatmadan içme; kaynattıktan sonra 2–3 gün içinde tüket.' },
  { id: 'sut-uht', name: 'Uzun Ömürlü Süt', img: '🥛', category: 'sut', days: { pantry: 90, fridge: 90 }, opened: 3, tett: true, keywords: ['süt', 'uht', 'kutu süt'], tip: 'Açılmadan dolap dışında aylarca dayanır; açınca dolaba koy, 3 gün içinde bitir.' },
  { id: 'yogurt', name: 'Yoğurt', img: '🥣', category: 'sut', days: { fridge: 14 }, opened: 4, keywords: ['süzme', 'yoğurdu', 'bebek yoğurdu'] },
  { id: 'beyaz-peynir', name: 'Beyaz Peynir', img: '🧀', category: 'sut', days: { fridge: 30 }, opened: 7, keywords: ['peynir', 'feta', 'hellim', 'köy peyniri', 'ezine', 'ezine peyniri', 'tulum', 'tulum peyniri', 'koyun peyniri', 'keçi peyniri'], tip: 'Kendi tuzlu suyunda, kapalı kapta sakla.' },
  { id: 'kasar', name: 'Kaşar', img: '🧀', category: 'sut', days: { fridge: 30, freezer: 90 }, opened: 7, keywords: ['peynir', 'tost peyniri'] },
  { id: 'lor', name: 'Lor', img: '🧀', category: 'sut', days: { fridge: 5 }, opened: 3, keywords: ['peynir', 'çökelek', 'ricotta', 'taze peynir', 'mozzarella', 'çiğ süt peyniri'] },
  { id: 'labne', name: 'Labne', img: '🫙', category: 'sut', days: { fridge: 21 }, opened: 7, keywords: ['peynir', 'krem peynir'] },
  { id: 'krema', name: 'Krema', img: '🥛', category: 'sut', days: { fridge: 14 }, opened: 4, keywords: ['süt kreması', 'krem şanti', 'şanti', 'sıvı krema'] },
  { id: 'kaymak', name: 'Kaymak', img: '🧈', category: 'sut', days: { fridge: 4 } },
  { id: 'tereyagi', name: 'Tereyağı', img: '🧈', category: 'sut', days: { fridge: 30, freezer: 180 } },
  { id: 'yumurta', name: 'Yumurta', img: '🥚', category: 'sut', days: { fridge: 28 }, tip: 'Kapı rafında değil, iç raflarda kutusuyla sakla.' },
  { id: 'haslanmis-yumurta', name: 'Haşlanmış Yumurta', img: '🥚', category: 'sut', days: { fridge: 7 }, keywords: ['katı yumurta'], tip: 'Kabuğuyla dolapta 1 hafta; soyulmuşsa aynı gün tüket.' },
  { id: 'zeytin', name: 'Zeytin', img: '🫒', category: 'sut', days: { fridge: 60 }, opened: 14 },

  // — Et, Tavuk & Balık —
  { id: 'tavuk', name: 'Tavuk', img: '🍗', category: 'et', days: { fridge: 2, freezer: 270 }, keywords: ['göğüs', 'but', 'kanat', 'tavuk göğsü'], tip: 'En alt rafta, kapalı kapta sakla; suyu diğer gıdalara damlamasın.' },
  { id: 'kiyma', name: 'Kıyma', img: '🥩', category: 'et', days: { fridge: 2, freezer: 120 }, keywords: ['köfte harcı'], tip: 'Hemen kullanmayacaksan yassı poşetlerde dondur; çabuk çözülür.' },
  { id: 'kirmizi-et', name: 'Kırmızı Et', img: '🥩', category: 'et', days: { fridge: 3, freezer: 180 }, keywords: ['et', 'pirzola', 'kuzu pirzola', 'kuşbaşı', 'biftek', 'antrikot', 'dana', 'kuzu'] },
  { id: 'sakatat', name: 'Sakatat', img: '🥩', category: 'et', days: { fridge: 1, freezer: 120 }, keywords: ['ciğer', 'ciğeri', 'böbrek', 'böbreği', 'işkembe', 'yürek', 'yüreği', 'dalak', 'kokoreç', 'uykuluk', 'beyin', 'taşlık', 'taşlığı'], tip: 'Sakatat çiğ etten de çabuk bozulur; aldığın gün pişir ya da hemen dondur.' },
  { id: 'balik', name: 'Balık', img: '🐟', category: 'et', days: { fridge: 2, freezer: 90 }, keywords: ['hamsi', 'levrek', 'çipura', 'somon', 'palamut', 'uskumru'] },
  { id: 'karides', name: 'Karides', img: '🦐', category: 'et', days: { fridge: 2, freezer: 180 } },
  { id: 'midye', name: 'Midye', img: '🦪', category: 'et', days: { fridge: 1 }, keywords: ['midye dolma', 'midye tava'], tip: 'Midye dolma ve tava aynı gün tüketilmeli; bekletme.' },
  { id: 'sushi', name: 'Sushi / Çiğ Balık', img: '🍣', category: 'et', days: { fridge: 1 }, keywords: ['sushi', 'suşi', 'sashimi', 'tartar'], tip: 'Çiğ balık aynı gün tüketilmeli.' },
  { id: 'sucuk', name: 'Sucuk', img: '🥓', category: 'et', days: { fridge: 21, freezer: 60 }, opened: 7 },
  { id: 'pastirma', name: 'Pastırma', img: '🥓', category: 'et', days: { fridge: 30 }, opened: 7 },
  { id: 'salam', name: 'Salam / Jambon', img: '🥓', category: 'et', days: { fridge: 14 }, opened: 5, keywords: ['jambon', 'hindi füme', 'füme'] },
  { id: 'sosis', name: 'Sosis', img: '🌭', category: 'et', days: { fridge: 14, freezer: 60 }, opened: 5 },

  // — Ev Yemeği —
  { id: 'ev-yemegi', name: 'Tencere Yemeği', img: '🥘', category: 'yemek', days: { fridge: 3, freezer: 90 }, keywords: ['yemek', 'kuru fasulye', 'fasulye', 'nohut', 'türlü', 'musakka', 'etli', 'sebze yemeği', 'güveç', 'kavurma', 'dün pişirdim', 'zeytinyağlı', 'karnıyarık', 'imam bayıldı', 'kızartma', 'patlıcan kızartması', 'kabak yemeği', 'taze fasulye yemeği', 'kuru fasulye yemeği', 'nohut yemeği', 'tavuk sote', 'etli yemek'], tip: 'Pişirdikten sonra en geç 2 saat içinde, sıcak da olsa küçük kaplara bölüp dolaba koy; ocakta sabaha bırakma.' },
  { id: 'corba', name: 'Çorba', img: '🍲', category: 'yemek', days: { fridge: 3, freezer: 90 }, keywords: ['mercimek çorbası', 'ezogelin', 'yayla', 'tarhana çorbası', 'kemik suyu', 'tavuk suyu', 'et suyu'] },
  { id: 'pilav', name: 'Pilav (pişmiş)', img: '🍚', category: 'yemek', days: { fridge: 2, freezer: 60 }, keywords: ['pirinç pilavı', 'bulgur pilavı'], tip: 'Pilavı tencerede bekletme; 1 saat içinde dolaba koy, yalnızca bir kez ısıt.' },
  { id: 'makarna', name: 'Makarna (pişmiş)', img: '🍝', category: 'yemek', days: { fridge: 3 }, keywords: ['haşlanmış makarna'] },
  { id: 'kofte', name: 'Köfte (pişmiş)', img: '🧆', category: 'yemek', days: { fridge: 3, freezer: 90 }, keywords: ['kuru köfte', 'izmir köfte', 'ızgara köfte'] },
  { id: 'pismis-tavuk', name: 'Pişmiş Tavuk', img: '🍗', category: 'yemek', days: { fridge: 3, freezer: 90 } },
  { id: 'borek', name: 'Börek', img: '🥧', category: 'yemek', days: { fridge: 3, freezer: 120 }, keywords: ['su böreği', 'sigara böreği', 'kol böreği', 'gözleme'] },
  { id: 'manti', name: 'Mantı', img: '🥟', category: 'yemek', days: { fridge: 3, freezer: 90 } },
  { id: 'sarma', name: 'Sarma / Dolma', img: '🌯', category: 'yemek', days: { fridge: 4, freezer: 90 }, keywords: ['dolma', 'yaprak sarma', 'biber dolması'] },
  { id: 'pizza', name: 'Pizza', img: '🍕', category: 'yemek', days: { fridge: 3, freezer: 60 } },
  { id: 'salata', name: 'Salata', img: '🥗', category: 'yemek', days: { fridge: 2 }, keywords: ['cacık', 'piyaz'], tip: 'Sosunu ayrı sakla; soslu salata birkaç saatte söner.' },
  { id: 'sandvic', name: 'Sandviç / Dürüm', img: '🥪', category: 'yemek', days: { fridge: 2 } },
  { id: 'meyve-puresi', name: 'Meyve / Sebze Püresi', img: '🥣', category: 'yemek', days: { fridge: 2, freezer: 30 }, keywords: ['püre', 'elma püresi', 'muz püresi', 'bebek püresi', 'patates püresi', 'kavanoz mama'], tip: 'Bebek için hazırlanan püreyi kaşıkla doğrudan kavanozdan yedirme; kalanı 1–2 gün içinde bitir.' },
  { id: 'paket-servis', name: 'Paket Servis', img: '🥡', category: 'yemek', days: { fridge: 2 }, keywords: ['döner', 'dürüm', 'lahmacun', 'pide', 'kebap', 'hamburger', 'sipariş'] },
  { id: 'tatli', name: 'Sütlü Tatlı', img: '🍮', category: 'yemek', days: { fridge: 3 }, keywords: ['sütlaç', 'muhallebi', 'puding', 'kazandibi', 'tatlı', 'pasta kreması'] },

  // — Ekmek & Fırın —
  { id: 'ekmek', name: 'Ekmek', img: '🍞', category: 'firin', days: { counter: 3, freezer: 90 }, keywords: ['tost ekmeği', 'somun', 'kepekli ekmek', 'tam buğday ekmek', 'çavdar ekmeği', 'köy ekmeği'], tip: 'Dolapta bayatlar. Dilimleyip dondur, gerektiğinde kızartıcıda ısıt.' },
  { id: 'baget', name: 'Baget', img: '🥖', category: 'firin', days: { counter: 2, freezer: 60 } },
  { id: 'lavas', name: 'Lavaş', img: '🫓', category: 'firin', days: { counter: 7, fridge: 14 } },
  { id: 'simit', name: 'Simit / Açma', img: '🥯', category: 'firin', days: { counter: 1, freezer: 60 } },
  { id: 'pogaca', name: 'Poğaça / Kruvasan', img: '🥐', category: 'firin', days: { counter: 1, fridge: 3, freezer: 60 } },
  { id: 'kek', name: 'Pasta / Kek', img: '🍰', category: 'firin', days: { fridge: 4 }, keywords: ['pasta', 'tatlı', 'kurabiye'] },

  // — İçecek —
  { id: 'meyve-suyu', name: 'Meyve Suyu', img: '🧃', category: 'icecek', days: { pantry: 120, fridge: 21 }, opened: 5, tett: true, keywords: ['portakal suyu', 'vişne suyu'] },
  { id: 'taze-sikma', name: 'Taze Sıkma Meyve Suyu', img: '🧃', category: 'icecek', days: { fridge: 2 }, keywords: ['taze portakal suyu', 'sıkma portakal suyu', 'taze sıkılmış', 'sıkılmış portakal suyu', 'taze sıkma'], tip: 'Pastörize edilmemiştir: buzdolabında sakla, 2–3 gün içinde iç.' },
  { id: 'ayran', name: 'Ayran', img: '🥛', category: 'icecek', days: { fridge: 14 }, opened: 2 },
  { id: 'kefir', name: 'Kefir', img: '🥛', category: 'icecek', days: { fridge: 14 }, opened: 4 },
  { id: 'kola', name: 'Gazlı İçecek', img: '🥤', category: 'icecek', days: { pantry: 270 }, opened: 3, tett: true, keywords: ['kola', 'coca cola', 'gazoz', 'soda', 'maden suyu', 'enerji içeceği', 'fanta', 'sprite'] },

  // — Sos & Kavanoz —
  { id: 'salca', name: 'Salça', img: '🥫', category: 'sos', days: { pantry: 365, fridge: 365 }, opened: 60, tett: true, keywords: ['biber salçası', 'domates salçası', 'ev salçası'], tip: 'Açılınca dolaba koy, temiz kaşıkla kullan; üstüne yağ dökmek küfü geciktirir. Küf görürsen kazıma, kavanozu at.' },
  { id: 'humus', name: 'Humus', img: '🫘', category: 'sos', days: { fridge: 5 }, keywords: ['hummus'] },
  { id: 'tursu', name: 'Turşu', img: '🫙', category: 'sos', days: { pantry: 180, fridge: 180 }, opened: 30, tett: true },
  { id: 'mayonez', name: 'Mayonez', img: '🫙', category: 'sos', days: { pantry: 180, fridge: 180 }, opened: 60, tett: true, tip: 'Açıldıktan sonra mutlaka dolapta sakla. Ev yapımı (çiğ yumurtalı) mayonez 2–3 gün dayanır.' },
  { id: 'recel', name: 'Reçel', img: '🍯', category: 'sos', days: { pantry: 365, fridge: 365 }, opened: 60, tett: true, keywords: ['marmelat'] },
  { id: 'konserve', name: 'Açılmış Konserve', img: '🥫', category: 'sos', days: { fridge: 3 }, opened: 3 },
  { id: 'konserve-kapali', name: 'Konserve (kapalı)', img: '🥫', category: 'sos', days: { pantry: 730, fridge: 730 }, opened: 3, tett: true, keywords: ['konserve', 'ton balığı', 'ton balığı konservesi', 'mısır konservesi', 'nohut konservesi', 'fasulye konservesi'], tip: 'Açınca içeriği cam ya da plastik kaba alıp dolaba koy; 2–3 gün içinde tüket.' },
  { id: 'findik-kremasi', name: 'Fındık Kreması', img: '🫙', category: 'sos', days: { pantry: 365 }, opened: 90, tett: true, keywords: ['nutella', 'kakaolu fındık kreması', 'fıstık ezmesi', 'fındık ezmesi'] },
  { id: 'salamura-yaprak', name: 'Salamura Yaprak', img: '🫙', category: 'sos', days: { pantry: 365, fridge: 365 }, opened: 30, tett: true, keywords: ['asma yaprağı', 'yaprak', 'salamura asma yaprağı', 'sarmalık yaprak'], tip: 'Açılınca yaprakları salamura suyunun içinde bırakıp dolapta sakla.' },
  // — Bakliyat & Tahıl (kiler) —
  { id: 'pirinc', name: 'Pirinç', img: '🍚', category: 'kuru', days: { pantry: 365 }, keywords: ['baldo', 'osmancık'], tip: 'Ağzı kapalı kavanozda, serin ve kuru yerde sakla; böceklenmeyi önler.' },
  { id: 'bulgur', name: 'Bulgur', img: '🌾', category: 'kuru', days: { pantry: 365 }, keywords: ['pilavlık', 'köftelik'] },
  { id: 'mercimek', name: 'Mercimek', img: 'mercimek', category: 'kuru', days: { pantry: 365 }, keywords: ['kırmızı mercimek', 'yeşil mercimek'] },
  { id: 'nohut', name: 'Nohut', img: 'nohut', category: 'kuru', days: { pantry: 365 } },
  { id: 'kuru-fasulye', name: 'Kuru Fasulye', img: '🫘', category: 'kuru', days: { pantry: 365 }, keywords: ['barbunya'] },
  { id: 'taze-makarna', name: 'Taze Makarna / Erişte', img: '🍝', category: 'yemek', days: { fridge: 2, freezer: 60 }, keywords: ['taze makarna', 'taze erişte', 'yaş erişte', 'taze lazanya', 'ravioli'], tip: 'Yumurtalı taze hamur buzdolabında kısa dayanır; paketliyse paketteki tarihe bak.' },
  { id: 'ev-konservesi', name: 'Ev Konservesi', img: '🫙', category: 'sos', days: { pantry: 365 }, opened: 3, keywords: ['ev konservesi', 'kavanoz konserve', 'ev yapımı konserve'], tip: 'Ev konservesini 1 yıl içinde tüket. Kapağı şişmiş, köpüren ya da kötü kokan kavanozu açmadan at.' },
  { id: 'kuru-makarna', name: 'Makarna (kuru)', img: '🍝', category: 'kuru', days: { pantry: 365 }, keywords: ['spagetti', 'erişte', 'şehriye', 'penne'] },
  { id: 'un', name: 'Un', img: 'un', category: 'kuru', days: { pantry: 180, freezer: 365 }, keywords: ['buğday unu'], tip: 'Uzun süre kullanmayacaksan dondurucuda sakla; kurtlanmaz, bayatlamaz.' },
  { id: 'tam-bugday-unu', name: 'Tam Buğday Unu', img: 'un', category: 'kuru', days: { pantry: 60, fridge: 180, freezer: 180 }, keywords: ['kepekli un', 'tam buğday unu'], tip: 'Kepeği yağ içerdiği için beyaz undan çabuk acılaşır; serin yerde ya da buzdolabında sakla.' },
  { id: 'yulaf', name: 'Yulaf', img: 'yulaf', category: 'kuru', days: { pantry: 180 }, keywords: ['yulaf ezmesi', 'granola', 'müsli'] },
  { id: 'irmik', name: 'İrmik', img: 'irmik', category: 'kuru', days: { pantry: 180 } },
  { id: 'tarhana', name: 'Tarhana', img: '🥣', category: 'kuru', days: { pantry: 365 }, keywords: ['ev tarhanası'] },
  { id: 'eriste', name: 'Erişte', img: '🍝', category: 'kuru', days: { pantry: 365 }, keywords: ['ev eriştesi', 'şehriye'] },
  { id: 'yarma', name: 'Yarma / Dövme', img: '🌾', category: 'kuru', days: { pantry: 365 }, keywords: ['yarma', 'dövme', 'aşurelik', 'aşurelik buğday', 'buğday yarması'] },
  { id: 'kuskus', name: 'Kuskus', img: 'irmik', category: 'kuru', days: { pantry: 365 } },
  { id: 'nisasta', name: 'Nişasta', img: 'un', category: 'kuru', days: { pantry: 730 }, keywords: ['mısır nişastası', 'buğday nişastası'] },
  { id: 'hazir-corba', name: 'Hazır Çorba', img: '🍲', category: 'kuru', days: { pantry: 365 }, keywords: ['paket çorba', 'çorba paketi', 'hazır çorba'] },
  { id: 'noodle', name: 'Noodle', img: '🍜', category: 'kuru', days: { pantry: 270 }, keywords: ['hazır erişte', 'ramen', 'indomie'] },
  { id: 'kurutmalik', name: 'Kurutmalık Sebze', img: '🌶️', category: 'kuru', days: { pantry: 365 }, keywords: ['kuru biber', 'kurutulmuş biber', 'kuru patlıcan', 'kurutulmuş patlıcan', 'kuru kabak', 'kuru bamya', 'dolmalık kuru'] },
  { id: 'kuru-domates', name: 'Kuru Domates', img: '🍅', category: 'kuru', days: { pantry: 180, fridge: 365 }, keywords: ['güneşte kurutulmuş domates'] },
  { id: 'misir-gevregi', name: 'Mısır Gevreği', img: '🥣', category: 'kuru', days: { pantry: 180 }, opened: 30, keywords: ['kahvaltılık gevrek'] },

  // — Kuruyemiş & Kuru Meyve —
  { id: 'badem', name: 'Badem', img: 'badem', category: 'kuruyemis', days: { pantry: 90, fridge: 180, freezer: 365 }, tip: 'Kuruyemiş yağ içerir, sıcakta acılaşır. Uzun süre için buzdolabında kapalı kapta sakla.' },
  { id: 'findik', name: 'Fındık', img: 'findik', category: 'kuruyemis', days: { pantry: 90, fridge: 180, freezer: 365 }, tip: 'Küflü, buruşuk ya da acı tadı olan taneleri at; aflatoksin pişirmekle yok olmaz. Yazın serin yerde ya da buzdolabında sakla.' },
  { id: 'ceviz', name: 'Ceviz', img: 'ceviz', category: 'kuruyemis', days: { pantry: 30, fridge: 180, freezer: 365 }, tip: 'Ceviz içi çabuk acılaşır; buzdolabında saklamak ömrünü aylarca uzatır.' },
  { id: 'yer-fistigi', name: 'Yer Fıstığı', img: '🥜', category: 'kuruyemis', days: { pantry: 60, fridge: 180, freezer: 365 }, keywords: ['fıstık'], tip: 'Küflü, buruşuk ya da acı tadı olan taneleri at; aflatoksin pişirmekle yok olmaz. Yazın serin yerde ya da buzdolabında sakla.' },
  { id: 'antep-fistigi', name: 'Antep Fıstığı', img: 'antep', category: 'kuruyemis', days: { pantry: 90, fridge: 180, freezer: 365 }, keywords: ['fıstık'], tip: 'Küflü, buruşuk ya da acı tadı olan taneleri at; aflatoksin pişirmekle yok olmaz. Yazın serin yerde ya da buzdolabında sakla.' },
  { id: 'cam-fistigi', name: 'Çam Fıstığı', img: '🥜', category: 'kuruyemis', days: { pantry: 30, fridge: 90, freezer: 180 }, keywords: ['dolmalık fıstık', 'dolmalık fıstığı', 'çam fıstık'], tip: 'Çam fıstığı çok yağlıdır, kilerde çabuk acılaşır; ağzı kapalı kapta buzdolabında sakla.' },
  { id: 'kaju', name: 'Kaju', img: 'kaju', category: 'kuruyemis', days: { pantry: 90, fridge: 180, freezer: 365 } },
  { id: 'cekirdek', name: 'Ay Çekirdeği', img: '🌻', category: 'kuruyemis', days: { pantry: 60, fridge: 180, freezer: 365 }, keywords: ['kabak çekirdeği', 'kabağı çekirdeği', 'çekirdek'] },
  { id: 'leblebi', name: 'Leblebi', img: 'nohut', category: 'kuruyemis', days: { pantry: 120 }, keywords: ['sarı leblebi', 'beyaz leblebi'] },
  { id: 'susam', name: 'Susam', img: '🌾', category: 'kuruyemis', days: { pantry: 180, fridge: 365 }, keywords: ['çörek otu'] },
  { id: 'pestil', name: 'Pestil / Köme', img: 'kayisi', category: 'atistirmalik', days: { pantry: 180, fridge: 365 }, keywords: ['köme', 'cevizli sucuk', 'dut pestili'] },
  { id: 'kuru-uzum', name: 'Kuru Üzüm', img: '🍇', category: 'kuruyemis', days: { pantry: 180, fridge: 365 }, keywords: ['üzüm kurusu'] },
  { id: 'kuru-kayisi', name: 'Kuru Kayısı', img: 'kayisi', category: 'kuruyemis', days: { pantry: 180, fridge: 365 }, keywords: ['kayısı kurusu', 'gün kurusu'], tip: 'Küflü, buruşuk ya da acı tadı olan taneleri at; aflatoksin pişirmekle yok olmaz. Yazın serin yerde ya da buzdolabında sakla.' },
  { id: 'kuru-meyve', name: 'Kuru Meyve', img: 'kayisi', category: 'kuruyemis', days: { pantry: 180, fridge: 365 }, keywords: ['kuru incir', 'incir kurusu', 'kuru dut', 'dut kurusu', 'kuru erik', 'erik kurusu', 'kuru elma', 'elma kurusu', 'kuru armut', 'armut kurusu', 'kuru vişne', 'kuru kızılcık', 'kuru meyve'], tip: 'Küflü, buruşuk ya da acı tadı olan taneleri at; aflatoksin pişirmekle yok olmaz. Yazın serin yerde ya da buzdolabında sakla.' },
  { id: 'kabuklu-ceviz', name: 'Kabuklu Ceviz / Fındık', img: 'ceviz', category: 'kuruyemis', days: { pantry: 180, fridge: 365 }, keywords: ['kabuklu ceviz', 'kabuklu fındık', 'kabuklu badem'] },
  { id: 'hurma', name: 'Hurma', img: 'hurma', category: 'kuruyemis', days: { pantry: 60, fridge: 180 } },

  // — Yağ, Çay & Baharat —
  { id: 'zeytinyagi', name: 'Zeytinyağı', img: '🫒', category: 'temel', days: { pantry: 365 }, opened: 120, tip: 'Işık ve ısı acılaştırır; ocaktan uzakta, koyu şişede sakla.' },
  { id: 'sivi-yag', name: 'Sıvı Yağ', img: '🫗', category: 'temel', days: { pantry: 365 }, opened: 180, keywords: ['ayçiçek yağı', 'mısır yağı'] },
  { id: 'seker', name: 'Şeker', img: 'seker', category: 'temel', days: { pantry: 730 }, stable: true, keywords: ['toz şeker', 'küp şeker'] },
  { id: 'bal', name: 'Bal', img: '🍯', category: 'temel', days: { pantry: 730 }, stable: true, tip: 'Bal bozulmaz ama kristalleşebilir; ılık suda bekletince yeniden akışkanlaşır. 1 yaşından küçük bebeklere verilmez.' },
  { id: 'pekmez', name: 'Pekmez', img: 'pekmez', category: 'temel', days: { pantry: 365 }, opened: 180 },
  { id: 'nar-eksisi', name: 'Nar Ekşisi', img: 'pekmez', category: 'temel', days: { pantry: 365 }, opened: 180, keywords: ['ekşi', 'koruk'] },
  { id: 'ketcap', name: 'Ketçap / Hardal', img: '🫙', category: 'sos', days: { pantry: 365, fridge: 365 }, opened: 60, tett: true, keywords: ['ketçap', 'hardal', 'barbekü sos'] },
  { id: 'tahin', name: 'Tahin', img: '🫙', category: 'temel', days: { pantry: 365 }, opened: 90 },
  { id: 'cay', name: 'Çay', img: '🍵', category: 'temel', days: { pantry: 730 }, opened: 180, keywords: ['siyah çay', 'dökme çay'] },
  { id: 'bitki-cayi', name: 'Bitki Çayı', img: '🍵', category: 'temel', days: { pantry: 365 }, keywords: ['ıhlamur', 'adaçayı', 'papatya', 'kuşburnu'] },
  { id: 'hazir-kahve', name: 'Hazır Kahve', img: '☕', category: 'temel', days: { pantry: 365 }, opened: 90, keywords: ['nescafe', 'granül kahve', '3ü1 arada'] },
  { id: 'kahve', name: 'Kahve', img: '☕', category: 'temel', days: { pantry: 365 }, opened: 60, keywords: ['türk kahvesi', 'filtre kahve', 'çekirdek kahve'], tip: 'Açılmış kahveyi hava almayan kapta sakla; aroması birkaç haftada azalır; bu bir kalite tarihidir, güvenlik değil.' },
  { id: 'tuz', name: 'Tuz', img: '🧂', category: 'temel', days: { pantry: 1825 }, stable: true, keywords: ['kaya tuzu', 'deniz tuzu'] },
  { id: 'baharat', name: 'Baharat', img: '🌶️', category: 'temel', days: { pantry: 365 }, keywords: ['pul biber', 'kimyon', 'karabiber', 'nane kuru', 'kekik', 'isot', 'sumak', 'limon tuzu', 'tarçın', 'zerdeçal', 'yenibahar'], tip: 'Pul biber ve isotu serin, kuru yerde sakla; küflü ya da topaklanmış olanı at.' },
  { id: 'sirke', name: 'Sirke', img: '🫗', category: 'temel', days: { pantry: 730 }, stable: true, keywords: ['elma sirkesi', 'üzüm sirkesi'] },
  { id: 'maya', name: 'Kuru Maya', img: '🫙', category: 'temel', days: { pantry: 365 }, opened: 30, keywords: ['instant maya'] },
  { id: 'kabartma', name: 'Kabartma Tozu / Karbonat', img: '🧂', category: 'temel', days: { pantry: 540 }, opened: 180, keywords: ['kabartma tozu', 'kabartma', 'karbonat', 'soda bikarbonat', 'yemek sodası'], tip: 'Nem kabartma gücünü düşürür; ağzını sıkıca kapat. Emin değilsen bir kaşığını sıcak suya at: köpürüyorsa hâlâ iş görür.' },
  { id: 'yas-maya', name: 'Yaş Maya', img: '🧈', category: 'sut', days: { fridge: 14 }, keywords: ['taze maya'] },
  { id: 'sut-tozu', name: 'Süt Tozu', img: '🥛', category: 'temel', days: { pantry: 365 }, opened: 60 },
  { id: 'bebek-mamasi', name: 'Bebek Maması (toz)', img: '🍼', category: 'temel', days: { pantry: 365 }, opened: 28, keywords: ['mama', 'bebek maması', 'devam sütü', 'formül mama'], tip: 'Açılan kutuyu 3–4 hafta içinde bitir; hazırlanan mamayı bekletme.' },
  { id: 'hazir-mama', name: 'Hazırlanmış Mama', img: '🍼', category: 'yemek', days: { fridge: 1 }, keywords: ['hazırlanmış mama', 'biberon', 'hazır mama', 'hazır bebek maması', 'sıvı mama'], tip: 'Oda sıcaklığında 1 saatten fazla bekletme; dolapta 24 saat içinde kullan, artanı at.' },
  { id: 'kakao', name: 'Kakao', img: '🍫', category: 'temel', days: { pantry: 365 } },

  // — Atıştırmalık & Tatlı —
  { id: 'cikolata', name: 'Çikolata', img: '🍫', category: 'atistirmalik', days: { pantry: 180, fridge: 180 }, tip: 'Yazın dolapta, ağzı kapalı sakla; beyazlama zararsızdır.' },
  { id: 'paketli-kek', name: 'Paketli Kek', img: '🍰', category: 'atistirmalik', days: { pantry: 60 }, opened: 5, keywords: ['kek bar', 'paket kek'] },
  { id: 'biskuvi', name: 'Bisküvi', img: '🍪', category: 'atistirmalik', days: { pantry: 90 }, opened: 14, keywords: ['kurabiye', 'gofret'] },
  { id: 'cips', name: 'Cips', img: 'cips', category: 'atistirmalik', days: { pantry: 60 }, opened: 7, keywords: ['mısır cipsi', 'patlamış mısır', 'popcorn', 'patlamis misir'] },
  { id: 'kraker', name: 'Kraker', img: '🍘', category: 'atistirmalik', days: { pantry: 90 }, opened: 14, keywords: ['galeta', 'grissini'] },
  { id: 'lokum', name: 'Lokum', img: '🍬', category: 'atistirmalik', days: { pantry: 90 }, keywords: ['şekerleme', 'akide'] },
  { id: 'helva', name: 'Helva', img: '🍬', category: 'atistirmalik', days: { pantry: 120 }, opened: 30, keywords: ['tahin helvası'] },

  // — Dondurulmuş —
  { id: 'dondurma', name: 'Dondurma', img: '🍨', category: 'donuk', days: { freezer: 180 } },
  { id: 'donuk-sebze', name: 'Donuk Sebze', img: 'donuk-sebze', category: 'donuk', days: { freezer: 240 }, keywords: ['donuk bezelye', 'garnitür'] },
  { id: 'donuk-patates', name: 'Donuk Patates', img: '🍟', category: 'donuk', days: { freezer: 240 }, keywords: ['parmak patates'] },
  { id: 'yufka', name: 'Yufka / Milföy', img: '🫓', category: 'donuk', days: { fridge: 7, freezer: 90 }, keywords: ['baklava yufkası', 'milföy'] },
  { id: 'buz', name: 'Buz', img: '🧊', category: 'donuk', days: { freezer: 365 }, stable: true, keywords: ['buz kalıbı'], tip: 'Buz bozulmaz ama dondurucudaki kokuları çeker; tadı kaçtıysa yenile.' },
];

const byId = new Map(CATALOG.map((c) => [c.id, c]));

export function getCatalogItem(id: string | undefined): CatalogItem | undefined {
  return id ? byId.get(id) : undefined;
}

export function getCategory(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]!;
}

export function storageName(id: StorageId): string {
  return STORAGES.find((s) => s.id === id)?.name ?? id;
}

/** Ürünün varsayılan saklama yeri: `days` içinde ilk yazılan yer. */
export function defaultStorage(item: CatalogItem): StorageId {
  return (Object.keys(item.days)[0] as StorageId | undefined) ?? 'fridge';
}

/** Özel ürünler için katalog dışındaki ek görseller. */
const EXTRA_IMAGES = ['🍣', '🍤', '🍜', '🍛', '🌮', '🍖', '🥞', '🧇', '🧁', '🍩', '🍪', '🍫', '🥜', '🫕', '🍢', '🥠', '🍦', '🧋', '🍵', '🍺', '🍷', '🥤', '🍳', '🧉'];

/** Özel ürünlerde görsel seçimi için tekil görsel listesi. */
export const PICKABLE_IMAGES: string[] = Array.from(new Set([...CATALOG.map((c) => c.img), ...EXTRA_IMAGES]));

/**
 * Arama puanı (0 = eşleşmez): tam ad > adın başı > adda kelime başı > anahtar kelime başı.
 * Böylece "un" araması önce Un'u getirir, "kavun"u değil.
 */
export function queryScore(item: CatalogItem, q: string): number {
  if (!q) return 1;
  const qWords = words(q);
  if (qWords.length > 1) {
    // "sivri biber", "tavuk but": her kelime adın ya da anahtar kelimelerin bir kelimesinin başıyla eşleşmeli.
    const pool = [item.name, ...(item.keywords ?? [])].flatMap(words);
    if (searchKey(item.name) === q || (item.keywords ?? []).some((w) => searchKey(w) === q)) return 90;
    if (qWords.every((w) => pool.some((x) => x.startsWith(w)))) return 55;
    return 0;
  }
  const name = searchKey(item.name);
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (words(name).some((w) => w.startsWith(q)) || name.includes(` ${q}`)) return 60;
  const kws = (item.keywords ?? []).map(searchKey);
  if (kws.some((w) => w === q)) return 50;
  if (kws.some((w) => w.startsWith(q) || words(w).some((x) => x.startsWith(q)))) return 40;
  if (q.length >= 4 && name.includes(q)) return 20;
  return 0;
}

export function matchesQuery(item: CatalogItem, q: string): boolean {
  return queryScore(item, q) > 0;
}

/** Katalogda adı tam eşleşen ürün (özel ürünleri kataloğa bağlamak için). */
export function findExact(name: string): CatalogItem | undefined {
  const k = searchKey(name.trim());
  const byName = CATALOG.find((c) => searchKey(c.name) === k);
  if (byName) return byName;
  const byKeyword = CATALOG.filter((c) => (c.keywords ?? []).some((w) => searchKey(w) === k));
  return byKeyword.length === 1 ? byKeyword[0] : undefined;
}

/** Kelime kelime eşleşme: "un" yalnızca tek başına "un" kelimesini yakalar, "lahmacun"u değil. */
const words = (s: string) => searchKey(s).split(/[^a-z0-9]+/).filter(Boolean);
const hasWords = (hay: string[], needle: string[]) => hay.some((_, i) => needle.every((w, j) => hay[i + j] === w));

/** Pişmiş/hazırlanmış yemek sözcükleri: ham ürünün süresi asla devralınmaz (haşlanmış nohut kilerde 1 yıl olmaz). */
const COOKED = /\b(firin(?!\s+ekme\w*)|haslanmis\w*|haslama\w*|islatilmis|kizart\w*|kizarmis\w*|firinda|sote|kozlenmis|salatasi|ev yapimi|evde yapilan|menemen|pismis\w*|sosu|dunku|dun|artan|kalan|yagda|rafadan|kayisi yumurta|lop yumurta|sahanda\w*|cilbir|omlet\w*|hasladi\w*|pisirdi\w*|yaptim|yaptigim)\b/;
/** Yemek adı sözcükleri: "kuru patlıcan dolması" kurutmalık değil, yemektir. */
const DISH = /\b(yemeg\w*|yemek|dolma(?!lik)\w*|sarma\w*|kofte\w*|corba\w*|pilav\w*|kebab\w*|kebap\w*|borek\w*|boreg\w*|manti\w*|lahmacun|pide\w*|doner|tantuni|lazanya|guvec\w*|kapama|musakka|begendi|kunefe|baklava|sutlac|tatli\w*|salata\w*|cacik)\b/;
/** Kesilmiş/açılmış taze ürün: ürün aynı, ama açılmış sayılır (buzdolabı, kısa süre). "yarım paket" kesik değildir. */
const CUT = /\b(kesilmis|kesik|dilimlenmis|dilimi|dogranmis|soyulmus|acilmis|acik|acilan|yarim(?!\s+(paket|kilo|kg|kutu|litre|kavanoz|sise)))\b/;
/** "-li/-lu" ile başlayan iki kelimelik adlar çoğunlukla yemektir (peynirli börek, sütlü kahve). */
const DISH_ADJ = /^(\w+)(li|lu)\s+\w+/;
const NOT_DISH_ADJ = new Set(['tuz', 'kabuk', 'cekirdek', 'yag', 'cekirdeksiz', 'seker']);
/** Yağ oranı gibi niteleyiciler ürünü değiştirmez ("tam yağlı yoğurt" yoğurttur, süt değil). */
const QUALIFIERS = /\b(tam yagli|yarim yagli|az yagli|yagsiz|light|laktozsuz|organik)\b/g;
/** Türkçe tamlama ekleriyle gelen baş isimler: "vişne reçeli", "üzüm pekmezi", "su böreği". */
const HEADS: [RegExp, string][] = [
  // Bitki sütleri kuruyemiş ya da tahıl değildir: kutu sütü gibi saklanır (kapalıyken kiler, açılınca birkaç gün dolap).
  [/\b(badem|findik|fistik|kaju|ceviz|yulaf|pirinc|soya|hindistan cevizi|bitki\w*|bitkisel)\s+sutu\b/, 'sut-uht'],
  [/\b(hazirlanmis mama|biberon\w*|hazir (bebek )?mama\w*|sivi mama\w*)\b/, 'hazir-mama'],
  [/\bsut\s+kremasi\b/, 'krema'],
  [/\bpasta\s+kremasi\b/, 'tatli'],
  [/\b(receli|marmelati)\b/, 'recel'],
  [/\bpekmezi\b/, 'pekmez'],
  [/\btursusu\b/, 'tursu'],
  [/\beksisi\b/, 'nar-eksisi'],
  [/\bsalcasi\b/, 'salca'],
  [/\bboregi\b/, 'borek'],
  [/\bmantisi\b/, 'manti'],
  [/\bcekirdeg\w*\b/, 'cekirdek'],
  [/\bpeyniri\b/, 'beyaz-peynir'],
];

/** Sakatat: çiğ etten de kısa ömürlü; "kuzu ciğeri" kırmızı et değildir. */
const OFFAL = /\b(ciger\w*|bobreg?\w*|iskembe|yureg?\w*|dalak|kokorec|uykuluk|beyin|taslig?\w*)\b/;
/** Dondurulmuş hazır ürün: "donuk köfte", "dondurulmuş börek" dondurucuda kalır ("dondurma" değil). */
const FROZEN = /\b(donuk|dondurulmus)\b/;
/** Kuru gıda: açılınca da kilerde kalır, 3 günlük "açılmış" süresi verilmez. */
const DRY: ReadonlySet<CategoryId> = new Set<CategoryId>(['kuru', 'kuruyemis', 'temel']);
const isDry = (c: CatalogItem) => DRY.has(c.category) || (!PERISHABLE.has(c.category) && (c.days.pantry ?? 0) >= 30);
/** Kesilmiş/açılmış ürün tahmini: kuru gıdada (açılma süresi tanımsızsa) açılmış sayılmaz. */
const withOpened = (item: CatalogItem): Guess => (item.opened === undefined && isDry(item) ? { category: item.category, item } : { category: item.category, item, opened: true });

/** Önce bakılan tür kuralları (bozulabilir türler önce: "paket kıyma" kıymadır, kuru gıda değil). */
const RULES: [RegExp, CategoryId][] = [
  [/\b\w*(ezmesi|kremasi)\b/, 'sos'],
  [/\b(sushi|susi|tartar|ton|balig\w*|balik\w*|tavuk\w*|et|kuzu|dana|hindi|sucuk|sosis|kofte harci|kiyma|midye|kalamar|ahtapot|pirzola)\b/, 'et'],
  [DISH, 'yemek'],
  [/\b(peynir\w*|sut|yogur[td]\w*|kefir|krema|puding)\b/, 'sut'],
  [/\b(kabak\w*|balkabagi|turp|pazi|semizotu|enginar|bamya|kereviz|pirasa|lahana)\b/, 'sebze'],
  [/\b(dondurma|donuk|dondurulmus)\b/, 'donuk'],
  [/\b\w*suyu\b|\b(ice tea|soguk cay|salgam|limonata|enerji icecegi)\b/, 'icecek'],
  [/\b\w*unu\b/, 'kuru'],
];
/** En son bakılan kuru gıda kuralları. */
const DRY_RULES: [RegExp, CategoryId][] = [
  [/\b(badem|findik|ceviz|fisti[kg]\w*|kaju|cekirdek\w*|kavrulmus|leblebi|susam)\b/, 'kuruyemis'],
  [/\b(hazir|paket|instant|kutu|kuru|kurutulmus|\w+ kurusu)\b/, 'kuru'],
  [/\b(pirinc|bulgur|mercimek|nohut|kinoa|un|yulaf|makarna|irmik|sehriye|eriste|tarhana)\b/, 'kuru'],
  [/\b(cikolata\w*|biskuvi\w*|cips\w*|kraker\w*|gofret\w*|lokum|sekerleme|jelibon|lolipop|protein bar|bar|sakiz)\b/, 'atistirmalik'],
  [/\b(yag|cay|kahve|baharat|tuz|seker|sirke|kabartma|maya|vanilya)\b/, 'temel'],
  [/\b(ekmek|pogaca|simit|kek|pasta|kurabiye|lavas)\b/, 'firin'],
];

export interface Guess {
  category: CategoryId;
  /** Süresi ve görseli kullanılacak katalog ürünü (yoksa kategori varsayılanı). */
  item?: CatalogItem;
  /** Kesilmiş/açılmış olarak eklenmeli. */
  opened?: boolean;
}

/**
 * Özel ürünün adından tahmin. Sıra önemlidir:
 * 0) tamlama baş isimleri ("vişne reçeli" → Reçel, "hazırlanmış mama" → 24 saat),
 * 1) çok kelimeli katalog adları ("sivri biber", "kuru fasulye"); yanında yemek adı geçiyorsa yemek,
 * 2) pişmiş/hazırlanmış yemek sözcükleri (asla ham ürünün süresi değil),
 * 3) kesilmiş ürün (açılmış sayılır), 4) bozulabilir tür kuralları, 5) tek kelimeli katalog adı, 6) kuru gıda kuralları.
 * Emin olunamazsa undefined.
 */
export function guessCatalog(name: string): Guess | undefined {
  const k = searchKey(name).replace(QUALIFIERS, ' ').replace(/\s+/g, ' ').trim();
  if (!k) return undefined;
  // Taze sıkılmış meyve suyu pastörize değildir: kiler/uzun ömür asla.
  if (/\b(taze|sikma|sikilmis)\b/.test(k) && /\bsu(yu)?\b|\w+suyu\b/.test(k)) return { category: 'icecek', item: byId.get('taze-sikma') };
  if (/\bev konserve\w*\b/.test(k)) return { category: 'sos', item: byId.get('ev-konservesi') };
  // Açılmış konserve: içi buzdolabında 3 gün ("açılmış ton balığı", "açık mısır konservesi").
  if (/\b(acilmis|acik|acilan)\b/.test(k) && (/\bkonserve\w*\b/.test(k) || bestCatalogMatch(k)?.id === 'konserve-kapali')) {
    return { category: 'sos', item: byId.get('konserve') };
  }
  // "Lor peyniri", "kaşar peyniri": önce peynirin kendi türüne bak, yoksa beyaz peynir.
  if (/\bpeyniri\b/.test(k)) {
    // "Çiğ süt peyniri" → Lor (anahtar kelime), "çiğ süt" değil.
    const isCheese = (c?: CatalogItem) => !!c && (c.keywords ?? []).includes('peynir');
    const full = bestCatalogMatch(k, 'sut', 3);
    const own = isCheese(full) ? full : bestCatalogMatch(k.replace(/\bpeyniri\b/, ' '), 'sut');
    if (own && isCheese(own)) return CUT.test(k) ? withOpened(own) : { category: 'sut', item: own };
  }
  // "Fırın poğaça", "fırın ekmeği": fırın ürünü (pastane), yemek değil. "Fırın makarna/tavuk" ise fırında pişmiş yemektir.
  if (/\bfirin\b/.test(k)) {
    const rest = k.replace(/\bfirin\w*\b/g, ' ').replace(/\s+/g, ' ').trim();
    const bakery = rest ? bestCatalogMatch(rest, 'firin') : undefined;
    if (bakery || /\b(ekmek\w*|ekmeg\w*|simi\w*|pogaca\w*|acma\w*|corek\w*|kruvasan\w*|francala\w*|baget\w*|somun\w*|kek\w*|pasta\w*|kurabiye\w*|lavas\w*)\b/.test(rest)) return { category: 'firin', item: bakery };
  }
  // Donuk hazır ürün: dondurucunun süresi (ham/pişmiş hâlin buzdolabı süresi değil).
  if (FROZEN.test(k)) return { category: 'donuk', item: bestCatalogMatch(k, 'donuk') };
  for (const [re, id] of HEADS) {
    const item = byId.get(id);
    // "Açılmış badem sütü", "açık salça": baş isim bulunur, açıklık korunur.
    if (re.test(k) && item) return CUT.test(k) ? withOpened(item) : { category: item.category, item };
  }
  const multi = bestCatalogMatch(k, undefined, 2);
  if (multi) {
    const rest = words(k).filter((w) => !words(multi.name).includes(w) && !(multi.keywords ?? []).some((kw) => words(kw).includes(w))).join(' ');
    if (multi.category !== 'yemek' && (DISH.test(rest) || COOKED.test(rest))) return { category: 'yemek' };
    if (CUT.test(rest)) return withOpened(multi);
    return { category: multi.category, item: multi };
  }
  if (/\b(pure|puresi)\b/.test(k)) return { category: 'yemek', item: byId.get('meyve-puresi') };
  // "Kalan süt", "artan ekmek": yalnızca "kalan/artan/dün" sözcüğü yüzünden yemek sayılmaz; pişmeyen bilinen ürünse o üründür.
  const LEFTOVER = /\b(dunku|dun|artan|kalan)\b/g;
  if (COOKED.test(k) && !COOKED.test(k.replace(LEFTOVER, ' '))) {
    const plain = bestCatalogMatch(k.replace(LEFTOVER, ' ').replace(/\s+/g, ' ').trim());
    if (plain && ['sut', 'firin', 'icecek', 'sos', 'meyve', 'kuruyemis', 'atistirmalik', 'temel'].includes(plain.category)) return { category: plain.category, item: plain };
  }
  if (COOKED.test(k)) {
    // Pişmiş pirinç/makarna: Bacillus cereus riski; kendi kısa süreleri.
    if (/\b(pirinc\w*|pilav\w*)\b/.test(k)) return { category: 'yemek', item: byId.get('pilav') };
    if (/\bmakarna\w*\b/.test(k)) return { category: 'yemek', item: byId.get('makarna') };
    return { category: 'yemek' };
  }
  if (/\bkonserve\w*\b/.test(k)) return { category: 'sos', item: byId.get('konserve-kapali') };
  // "Elma kurusu", "kuru vişne": kuru meyve.
  const dried = /\b(\w+) kurusu\b/.exec(k) ?? /\bkuru (\w+)\b/.exec(k);
  if (dried && !DISH.test(k) && bestCatalogMatch(dried[1]!, 'meyve')) return { category: 'kuruyemis', item: byId.get('kuru-meyve') };
  if (CUT.test(k)) {
    const item = bestCatalogMatch(k);
    // Tanınmayan açık/kesik ürün yemek sayılmaz: türünü kullanıcı seçer.
    return item ? withOpened(item) : undefined;
  }
  const adj = DISH_ADJ.exec(k);
  if (adj && !NOT_DISH_ADJ.has(adj[1]!)) {
    // "Sütlü çikolata", "meyveli yoğurt": son kelime paketli bir ürünse o üründür; değilse yemek.
    const last = bestCatalogMatch(k.split(' ').slice(1).join(' '));
    // Kuru gıda (makarna, bulgur) ve yumurta burada sayılmaz: "kıymalı makarna", "sucuklu yumurta" pişmiş yemektir.
    const meaty = /^(sucuk|kiyma|et|tavuk|sosis|pastirma|salam|kavurma|kofte)(li|lu)$/.test(adj[0].split(' ')[0]!);
    if (last && !meaty && last.id !== 'yumurta' && ['atistirmalik', 'sut', 'kuruyemis', 'firin', 'icecek', 'donuk'].includes(last.category)) return { category: last.category, item: last };
    if (DRY_RULES.some(([re, c]) => c === 'atistirmalik' && re.test(k))) return { category: 'atistirmalik' };
    return { category: 'yemek' };
  }
  if (OFFAL.test(k) && !DISH.test(k)) return { category: 'et', item: byId.get('sakatat') };
  for (const [re, category] of RULES) if (re.test(k)) return { category, item: bestCatalogMatch(k, category) };
  const item = bestCatalogMatch(k);
  if (item) return { category: item.category, item };
  for (const [re, category] of DRY_RULES) if (re.test(k)) return { category };
  return undefined;
}

/** "dünkü çorba" → 1 gün önce pişmiş; ad ise "Çorba". */
export function parseAgo(name: string): { ago: number; name: string } {
  const m = /^\s*(dünkü|dün|evvelsi günkü|evvelki günkü)\s+/i.exec(name);
  if (!m) return { ago: 0, name };
  const rest = name.slice(m[0].length);
  return { ago: m[1]!.toLocaleLowerCase('tr').startsWith('dün') ? 1 : 2, name: rest.charAt(0).toLocaleUpperCase('tr') + rest.slice(1) };
}

/** Adın içinde kelime olarak geçen en uzun katalog adı ya da anahtar kelimesi. */
function bestCatalogMatch(k: string, category?: CategoryId, minWords = 1): CatalogItem | undefined {
  const hay = words(k);
  // "Makarna" kuru makarnadır; "(pişmiş)" ürün yalnızca adda pişmiş/yemek sözcüğü varsa.
  const cooked = COOKED.test(k) || DISH.test(k);
  let best: { item: CatalogItem; len: number } | undefined;
  for (const c of CATALOG) {
    if (category && c.category !== category) continue;
    if (!cooked && c.category === 'yemek' && c.name.includes('(pişmiş)')) continue;
    const names = [c.name.replace(/\s*\(.*\)/, ''), ...(c.keywords ?? [])];
    for (const [idx, w] of names.entries()) {
      const needle = words(w);
      if (needle.length < minWords) continue;
      // Ürünün kendi adı, başka ürünün anahtar kelimesinden önce gelir (pirinç → Pirinç, Pilav değil).
      const len = needle.join(' ').length + (idx === 0 ? 0.5 : 0);
      if (len >= 3 && hasWords(hay, needle) && (!best || len > best.len)) best = { item: c, len };
    }
  }
  return best?.item;
}

export function guessCategory(name: string): CategoryId | undefined {
  return guessCatalog(name)?.category;
}

/** Katalogda olmayan ürünler için kategoriye göre temkinli varsayılan süreler. */
export const CUSTOM_DAYS: Record<CategoryId, Partial<Record<StorageId, number>>> = {
  meyve: { fridge: 5, counter: 3, freezer: 120 },
  sebze: { fridge: 5, counter: 3, freezer: 120 },
  sut: { fridge: 5, freezer: 60 },
  et: { fridge: 2, freezer: 90 },
  yemek: { fridge: 3, freezer: 60 },
  firin: { counter: 2, fridge: 4, freezer: 60 },
  icecek: { pantry: 30, fridge: 30 },
  sos: { fridge: 14, pantry: 30 },
  kuru: { pantry: 180 },
  kuruyemis: { pantry: 60, fridge: 180, freezer: 365 },
  temel: { pantry: 180 },
  atistirmalik: { pantry: 60 },
  donuk: { freezer: 90 },
};

/** Türkçe duyarlı, aksan bağımsız arama anahtarı. */
export function searchKey(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/â/g, 'a');
}
