export type StorageId = 'fridge' | 'freezer' | 'counter' | 'pantry';
export type CategoryId = 'meyve' | 'sebze' | 'sut' | 'et' | 'yemek' | 'firin' | 'icecek' | 'sos' | 'kuru' | 'kuruyemis' | 'temel' | 'atistirmalik' | 'donuk';

export interface Category {
  id: CategoryId;
  name: string;
  img: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  /** Emoji karakteri ya da public/food içindeki özel görselin adı. */
  img: string;
  category: CategoryId;
  days: Partial<Record<StorageId, number>>;
  opened?: number;
  tip?: string;
  /** Aramada eşleşecek diğer adlar. */
  keywords?: string[];
  /** Pratikte bozulmayan ürün (buz, şeker, tuz, bal): uyarı verilmez. */
  stable?: boolean;
  /** Paketteki tarih bir kalite tarihidir (TETT): kapalıyken geçerse "kontrol et", "at" değil. */
  tett?: boolean;
}

/** Tarihler yerel gün olarak `YYYY-MM-DD` biçiminde tutulur. */
export type DayString = string;

export type DateSource = 'auto' | 'package' | 'manual';

/** Ürünün sayıldığı birim: yumurta adet, süt şişe, pişmiş yemek kap. */
export type Unit = 'adet' | 'paket' | 'kutu' | 'sise' | 'kavanoz' | 'kap' | 'porsiyon' | 'demet';
/** Açık paketin yaklaşık doluluğu (gram/ml değil, kabaca). */
export type Level = 'full' | 'half' | 'low';
/** Paketteki tarihin türü: kullanıcı seçer; kategoriden varsayılmaz. */
export type PackageKind = 'stt' | 'tett' | 'unknown';

export interface FridgeItem {
  id: string;
  catalogId?: string;
  name: string;
  img: string;
  category: CategoryId;
  storage: StorageId;
  quantity: number;
  addedAt: DayString;
  useBy: DayString;
  opened: boolean;
  dateSource: DateSource;
  /** Dondurucudan çözülmüş çiğ et: tekrar dondurulmaz. */
  thawed?: boolean;
  /** Birim; yoksa üründen varsayılır (unitOf). */
  unit?: Unit;
  /** Açık paketin yaklaşık doluluğu. */
  level?: Level;
  /** Satın alınma günü (isteğe bağlı). `addedAt` yalnızca uygulamaya eklendiği gündür. */
  boughtAt?: DayString;
  /** Paketin açıldığı gün. */
  openedAt?: DayString;
  /** Yemeğin pişirildiği gün. */
  cookedAt?: DayString;
  /**
   * Kapalıyken geçerli sınır: paketteki tarih, elle girilen tarih ya da tahmin.
   * `useBy` = açıksa bu sınır ile "açılış + açık ömrü"nden erken olanı.
   */
  baseUseBy?: DayString;
  /** Paketteki tarihin türü (dateSource 'package' iken). */
  packageKind?: PackageKind;
  /** Bir tariften artan yemek: yenmesi başarı oranında ikinci kez sayılmaz. */
  fromRecipe?: boolean;
}

/**
 * İleriye dönük plan: "Pazar günü ıspanak yemeği yapacağım". O gün ana ekranda hatırlatılır, takvim dosyasına da girer.
 * Bir ürüne (itemId) ya da tarife (recipeId) bağlı olabilir; ürün bitse de plan kalır.
 */
export interface Plan {
  id: string;
  day: DayString;
  /** Ne yapılacak: "Ispanak yemeği", "Kavurma", "Kahvaltıda ye". */
  title: string;
  itemId?: string;
  catalogId?: string;
  /** Ürünün adı ve görseli (ürün bittikten sonra da gösterilir). */
  name: string;
  img: string;
  category: CategoryId;
  recipeId?: string;
  createdAt: DayString;
}

/** Alışveriş listesi satırı. */
export interface ShoppingItem {
  id: string;
  name: string;
  catalogId?: string;
  img: string;
  category: CategoryId;
  quantity: number;
  unit: Unit;
  done: boolean;
  addedAt: DayString;
}

export type Outcome = 'eaten' | 'wasted';

export interface HistoryEntry {
  id: string;
  name: string;
  img: string;
  category: CategoryId;
  outcome: Outcome;
  date: DayString;
  quantity: number;
  /** Geri getirmek için ürünün o anki hâli. */
  item?: FridgeItem;
  unit?: Unit;
  /** Tariften artan yemeğin yenmesi: malzemeleri zaten sayıldı, oranda tekrar sayılmaz. */
  derived?: boolean;
}

export type Urgency = 'expired' | 'today' | 'soon' | 'fresh';

export interface Settings {
  /** Tüketme gününden kaç gün önce uyarılsın. */
  leadDays: number;
  notifications: boolean;
  lastNotified?: DayString;
  /** Ana sayfadaki "nasıl okunur" ipucu kapatıldı mı. */
  legendSeen?: boolean;
  /** "Telefonuna hatırlatıcı kur" önerisi kapatıldı mı. */
  calendarHintSeen?: boolean;
  /** Ana ekrandaki "Telefon hatırlatmalarını ayarla" kartı kapatıldı mı. */
  reminderCardDismissed?: boolean;
  /**
   * Takvim dosyası durumu. İndirmek kurulum demek değildir: kullanıcı takvimine eklediğini onaylayana kadar 'prepared'.
   * `sig`: dosyadaki her ürünün imzası (tarih, miktar, yer, açıklık); değişiklik olunca "güncelle" denir.
   */
  calendar?: { status: 'prepared' | 'confirmed'; at: DayString; lead: number; sig: Record<string, string> };
}
