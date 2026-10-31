import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFridge } from '../store/useFridge';
import { daysLeft, freezeWorthIt, finishVerb, isStable, isUrgent, leftLabel, remainingRatio, sortByUrgency, urgency } from '../lib/freshness';
import { greeting, longDate, roughDuration } from '../lib/dates';
import { useToday } from '../lib/useToday';
import { ReminderCard } from '../components/ReminderCard';
import { PlansCard } from '../components/PlansCard';
import { planDayLabel } from '../lib/plans';
import type { AddPreset } from './AddScreen';
import { STORAGES, getCatalogItem, searchKey } from '../data/catalog';
import { FoodRing } from '../components/Food';
import { Fridge } from '../components/Fridge';
import { Icon } from '../components/Icon';
import { clearToast, toast } from '../components/Toast';
import { Sheet } from '../components/Sheet';
import { ShoppingList } from '../components/ShoppingList';
import { foodImageUrl } from '../lib/images';
import { hasLevel, isCountable, LEVEL_LABEL, qtyText, unitOf } from '../lib/units';
import type { FridgeItem, StorageId, Unit, Urgency } from '../types';

/**
 * Bir dokunuşta ne düşülür: tek tek sayılanlarda "1 adet yedim/kullandım", paketlerde "1 şişe bitti".
 * Meyve ve çiğ yenen sebzede "yedim", diğerlerinde "kullandım" (finishVerb).
 */
export function deductWords(item: FridgeItem): {
  unit: Unit;
  countable: boolean;
  one: string;
  word: 'yedim' | 'kullandım' | 'bitti';
  past: 'yendi' | 'kullanıldı' | 'bitti';
} {
  const unit = unitOf(item);
  const countable = isCountable(unit);
  const eat = finishVerb(item) === 'Yedim';
  const word = countable ? (eat ? 'yedim' : 'kullandım') : 'bitti';
  return {
    unit,
    countable,
    one: qtyText(1, unit),
    word,
    past: word === 'yedim' ? 'yendi' : word === 'kullandım' ? 'kullanıldı' : 'bitti',
  };
}

/**
 * Biten ürünü alışveriş listesine ekler (aynısı varsa tekrar eklenmez) ve kısa bir bildirim gösterir.
 * `undoFinish`: "bitti" bildiriminden çağrıldıysa, yeni bildirimin "Geri al"ı bitirmeyi de geri alır (önceki geri alma kaybolmasın).
 */
export function addItemToShopping(item: FridgeItem, undoFinish?: () => void) {
  const { addShopping } = useFridge.getState();
  const r = addShopping({
    name: item.name,
    catalogId: item.catalogId,
    img: item.img,
    category: item.category,
    unit: unitOf(item),
  });
  // Bildirimin kendi düğmesinden çağrılınca o bildirim kapanırken yenisi silinmesin.
  setTimeout(
    () =>
      toast({
        text: `${undoFinish ? `${item.name} bitti · ` : ''}${r.existed ? 'zaten alışveriş listesinde' : 'alışveriş listesine eklendi'}`,
        tone: 'good',
        undo:
          r.existed && !undoFinish
            ? undefined
            : () => {
                if (!r.existed) useFridge.getState().undoShopping(r);
                undoFinish?.();
              },
      }),
    0,
  );
}

/** "Bitti/attım"ı geri al: geçmiş kaydındaki miktar mutfaktaki güncel satıra geri eklenir; kayıt yoksa (eski) anlık görüntü geri konur. */
export function undoFinish(snap: FridgeItem, hid: string | undefined) {
  const st = useFridge.getState();
  if (hid && st.history.some((h) => h.id === hid)) st.revert(hid);
  else if (!hid) st.restore(snap, []);
}

/** Panel kapanıp tarihçedeki adımı geri alındıktan sonra çalıştır (ekleme ekranı tarihçeye karışmasın). */
const afterSheetClosed = (fn: () => void) => {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    window.removeEventListener('popstate', run);
    fn();
  };
  window.addEventListener('popstate', run);
  setTimeout(run, 450);
};

type Filter = 'all' | StorageId;

/** Tarihi geçenler grubunun açıklaması, içindeki tarih türlerine göre. */
function expiredHint(list: FridgeItem[]): string {
  const stt = list.some((i) => i.dateSource === 'package' && i.packageKind === 'stt');
  if (stt && list.every((i) => i.dateSource === 'package' && i.packageKind === 'stt')) return 'Son tüketim tarihi (STT) geçti: tüketme.';
  if (stt) return 'STT’si geçenleri tüketme. Diğerlerini kontrol et; şüphedeysen tüketme.';
  return 'Son günü geçti. Ürünü kontrol et; şüphedeysen tüketme.';
}

const GROUPS: {
  id: string;
  title: string;
  hint?: string;
  match: (u: Urgency, left: number) => boolean;
}[] = [
  {
    id: 'now',
    title: 'Önce bunları kullan',
    match: (u) => u === 'today' || u === 'soon',
  },
  {
    id: 'expired',
    title: 'Tarihi geçenler',
    hint: 'Son günü geçti. Ürünü kontrol et; şüphedeysen tüketme.',
    match: (u) => u === 'expired',
  },
  {
    id: 'week',
    title: '7 gün içinde',
    match: (u, left) => u === 'fresh' && left <= 7,
  },
  {
    id: 'later',
    title: 'Daha sonra',
    match: (u, left) => u === 'fresh' && left > 7 && left <= 60,
  },
  {
    id: 'long',
    title: 'Uzun ömürlüler',
    hint: 'Aylarca dayanan kuru gıda, donuk ürün ve kavanozlar.',
    match: (u, left) => u === 'fresh' && left > 60,
  },
];

export function Home({ onAdd, onOpenItem, onCook }: { onAdd: (preset?: AddPreset) => void; onOpenItem: (id: string) => void; onCook: () => void }) {
  const items = useFridge((s) => s.items);
  const shopCount = useFridge((s) => s.shopping.filter((x) => !x.done).length);
  const [shopOpen, setShopOpen] = useState(false);
  const settings = useFridge((s) => s.settings);
  const { finish, loadDemo, setSettings } = useFridge.getState();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [showAllExpired, setShowAllExpired] = useState(false);
  const [showLong, setShowLong] = useState(false);
  const lastQuick = useRef(new Map<string, number>());
  const ref = useToday();
  const plans = useFridge((s) => s.plans);
  // Satırda en yakın plan günü görünür ("Plan: Pazar").
  const planByItem = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of plans) if (p.itemId && !m.has(p.itemId) && p.day >= ref) m.set(p.itemId, planDayLabel(p.day, ref));
    return m;
  }, [plans, ref]);
  const lead = settings.leadDays;

  const sorted = useMemo(() => sortByUrgency(items, ref), [items, ref]);
  const urgent = sorted.filter((i) => isUrgent(i, lead, ref));
  const expired = sorted.filter((i) => urgency(i, lead, ref) === 'expired');
  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: items.length,
      fridge: 0,
      freezer: 0,
      counter: 0,
      pantry: 0,
    };
    items.forEach((i) => c[i.storage]++);
    return c;
  }, [items]);

  // Seçili yerde ürün kalmadıysa "Tümü"ne dön.
  useEffect(() => {
    if (filter !== 'all' && counts[filter] === 0) setFilter('all');
  }, [filter, counts]);

  const q = searchKey(query.trim());
  const visible = sorted.filter((i) => (filter === 'all' || i.storage === filter) && (!q || [i.name, ...(getCatalogItem(i.catalogId)?.keywords ?? [])].some((w) => searchKey(w).includes(q))));

  const quick = (item: FridgeItem, el: HTMLElement) => {
    // Aynı satıra çift dokunuş bir kez sayılır; farklı satırlar hemen ardına dokunulabilir.
    if (Date.now() - (lastQuick.current.get(item.id) ?? 0) < 300) return;
    lastQuick.current.set(item.id, Date.now());
    // Tarihi geçmiş üründe tek dokunuşla karar verilmez: ayrıntı açılır (yedim mi attım mı).
    if (urgency(item, lead, ref) === 'expired') return onOpenItem(item.id);
    const snapshot = { ...item };
    const row = el.closest('li');
    const neighbour = (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLElement>('.item__main');
    const commit = () => {
      const hid = finish(item.id, 'eaten', 1);
      const w = deductWords(item);
      const last = item.quantity <= 1;
      toast({
        text: !last ? `${item.name}: ${w.one} ${w.past}, ${qtyText(item.quantity - 1, w.unit)} kaldı` : w.word === 'yedim' ? `${item.name} bitti, afiyet olsun!` : `${item.name} bitti`,
        tone: 'good',
        // Geri al, bu tüketimi geri ekler (başka sekmedeki değişikliklerin üstüne yazmaz).
        undo: () => undoFinish(snapshot, hid),
        action: last ? { label: 'Listeye ekle', run: () => addItemToShopping(snapshot, () => undoFinish(snapshot, hid)) } : undefined,
      });
      if (!settings.legendSeen) setSettings({ legendSeen: true });
      // Klavyeyle kullananın odağı kaybolmasın: yanındaki satıra geç.
      if (item.quantity <= 1 && document.activeElement === el) setTimeout(() => neighbour?.focus(), 0);
    };
    // Son tane biterken satır kısa bir çıkışla kaybolur (hareket azaltılmışsa hemen).
    if (item.quantity <= 1 && row && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      row.classList.add('is-leaving');
      setTimeout(commit, 180);
    } else commit();
  };

  // Satırlar memo'lu: her çizimde yeni fonksiyon verilmesin (yüzlerce üründe akıcılık).
  const quickRef = useRef(quick);
  quickRef.current = quick;
  const [onQuickStable] = useState(() => (item: FridgeItem, el: HTMLElement) => quickRef.current(item, el));

  /** Tarihi geçenlerin hepsini tek seferde "atıldı" say; tek "Geri al" hepsini döndürür. */
  const wasteAll = (list: FridgeItem[]) => {
    const done = list.map((i) => ({
      snap: { ...i },
      hid: finish(i.id, 'wasted'),
    }));
    toast({
      text: `${list.length} ürün atıldı olarak kaydedildi`,
      undo: () => done.forEach((d) => undoFinish(d.snap, d.hid)),
    });
  };

  if (items.length === 0) {
    return (
      <main className="screen home-empty">
        <header className="home-head">
          <p className="eyebrow">{greeting()}</p>
          <h1 className="display">Mutfakta Ne Var?</h1>
          <p className="lead">Buzdolabından kilere, her ürünün son gününü tahmin ederiz; son günü yaklaşanları uygulamada öne çıkarırız.</p>
        </header>
        <div className="empty-hero">
          <Fridge open items={['🥛', '🧀', '🍅', '🥚', '🥕', '🍓']} width={112} />
        </div>
        {/* Mutfak boşalsa da takvimdeki eski hatırlatıcılar için uyarı burada görünür. */}
        <ReminderCard today={ref} />
        <PlansCard today={ref} onOpenItem={onOpenItem} />
        <div className="empty-actions">
          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => onAdd()}>
            <Icon name="plus" size={20} stroke={2.5} /> İlk ürünü ekle
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              loadDemo();
              window.scrollTo({ top: 0 });
              setTimeout(() => document.querySelector<HTMLElement>('.home-head h1')?.focus(), 0);
            }}
          >
            Önce örnek mutfakla dene
          </button>
        </div>
        <ol className="steps">
          <li>
            <span className="steps__n">1</span>
            <div>
              <strong>Aldığını ekle</strong>
              <p>Market dönüşü birkaç dokunuşla.</p>
            </div>
          </li>
          <li>
            <span className="steps__n">2</span>
            <div>
              <strong>Süreyi biz hesaplarız</strong>
              <p>Her ürünün nerede saklandığına ve ortalama ömrüne göre.</p>
            </div>
          </li>
          <li>
            <span className="steps__n">3</span>
            <div>
              <strong>Yaklaşanları öne çıkarırız</strong>
              <p>Uygulamayı açınca en üstte görürsün. Uygulama kapalıyken hatırlatma için Ayarlar’dan takvimine ekleyebilirsin.</p>
            </div>
          </li>
        </ol>
      </main>
    );
  }

  // İpucu kartları listenin ilk grubundan sonra; büyük yazıda da ürünler ilk ekranda görünsün. Aynı anda tek kart (ReminderCard ipucu kapanınca çıkar).
  let hintsPlaced = false;
  const hints = (
    <>
      {!settings.legendSeen && (
        <aside className="legend-card">
          <div className="legend-card__demo" aria-hidden="true">
            <span className="days days--soon">
              <span className="days__big">2</span>
              <span className="days__small">gün kaldı</span>
            </span>
          </div>
          <p>
            <strong>Nasıl okunur?</strong> Sayı: son güne kalan gün. Halka: kalan süre. Kullandıkça <b>✓</b>’e dokun.
          </p>
          <button type="button" className="icon-btn legend-card__close" onClick={() => setSettings({ legendSeen: true })} aria-label="Açıklamayı kapat">
            <Icon name="x" size={16} />
          </button>
        </aside>
      )}

      <ReminderCard today={ref} />
    </>
  );

  return (
    <main className="screen">
      <header className="home-head home-head--bar">
        <div className="home-head__text">
          <p className="eyebrow">
            {greeting()} · {longDate(ref)}
          </p>
          <h1 className="display" tabIndex={-1}>
            Evde <span className="accent">{items.length}</span> ürün var
          </h1>
        </div>
        <button type="button" className="icon-btn shop-btn" onClick={() => setShopOpen(true)} aria-label={shopCount ? `Alışveriş listesi, ${shopCount} ürün` : 'Alışveriş listesi'}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2M10 21h.01M17 21h.01" />
          </svg>
          {shopCount > 0 && (
            <span className="shop-btn__badge" aria-hidden="true">
              {shopCount > 99 ? '99+' : shopCount}
            </span>
          )}
        </button>
      </header>

      <Sheet open={shopOpen} onClose={() => setShopOpen(false)} label="Alışveriş listesi">
        <ShoppingList
          onAddToKitchen={(x) => {
            setShopOpen(false);
            clearToast();
            afterSheetClosed(() => onAdd({ name: x.name, catalogId: x.catalogId, quantity: x.quantity, unit: x.unit, shoppingId: x.id }));
          }}
        />
      </Sheet>

      <PlansCard today={ref} onOpenItem={onOpenItem} />

      <PriorityHero urgent={urgent} expired={expired} next={sorted.find((i) => urgency(i, lead, ref) === 'fresh' && !isStable(i))} lead={lead} refDay={ref} onCook={onCook} onOpenItem={onOpenItem} />

      {items.length > 6 && (
        <label className="search search--home">
          <Icon name="search" size={18} />
          <input type="search" aria-label="Mutfağında ara" placeholder="Mutfağında ara" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={40} />
          {query && (
            <button type="button" className="search__clear" onClick={() => setQuery('')} aria-label="Aramayı temizle">
              <Icon name="x" size={16} />
            </button>
          )}
        </label>
      )}

      <div className="chips" role="group" aria-label="Saklama yeri">
        {(['all', ...STORAGES.map((s) => s.id)] as Filter[]).filter((f) => f === 'all' || counts[f] > 0 || filter === f).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} className={`chip ${filter === f ? 'is-active' : ''}`} onClick={() => setFilter(f)} disabled={f !== 'all' && counts[f] === 0}>
            {f === 'all' ? 'Tümü' : STORAGES.find((s) => s.id === f)!.short}
            <span className="chip__count">{counts[f]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 && <p className="no-results">“{query.trim()}” mutfağında yok.</p>}

      {visible.length === 0 && hints}
      {GROUPS.map((g) => {
        // Bozulmayan ürünler (bal, tuz, buz) her zaman uzun ömürlüler arasında.
        const all = visible.filter((i) => (isStable(i) ? g.id === 'long' : g.match(urgency(i, lead, ref), daysLeft(i, ref))));
        if (all.length === 0) return null;
        const others = visible.length - all.length;
        const collapsed = (g.id === 'expired' && !showAllExpired && all.length > 3) || (g.id === 'long' && !showLong && !q && filter === 'all' && others > 0);
        const list = collapsed ? all.slice(0, g.id === 'long' ? 0 : 2) : all;
        const first = !hintsPlaced;
        hintsPlaced = true;
        return (
          <Fragment key={g.id}>
            <section id={`grp-${g.id}`} className={`group group--${g.id}`} aria-labelledby={`g-${g.id}`}>
              <div className="group__head">
                <h2 id={`g-${g.id}`}>{g.title}</h2>
                <span className="group__count">{all.length}</span>
              </div>
              {(g.id === 'expired' ? expiredHint(all) : g.hint) && <p className="group__hint">{g.id === 'expired' ? expiredHint(all) : g.hint}</p>}
              {g.id === 'expired' && all.length > 1 && (
                <button type="button" className="show-more show-more--warn" onClick={() => wasteAll(all)}>
                  <Icon name="bin" size={16} /> Hepsini attım ({all.length})
                </button>
              )}
              <ul className="item-list">
                {list.map((item) => (
                  <ItemRow key={item.id} item={item} lead={lead} refDay={ref} onOpen={onOpenItem} onQuick={onQuickStable} plan={planByItem.get(item.id)} />
                ))}
              </ul>
              {collapsed && (
                <button type="button" className="show-more" onClick={() => (g.id === 'long' ? setShowLong(true) : setShowAllExpired(true))}>
                  {g.id === 'long' ? `${all.length} ürünü göster` : `${all.length - 2} ürün daha göster`}
                </button>
              )}
            </section>
            {first && hints}
          </Fragment>
        );
      })}
      <div className="list-end" />
    </main>
  );
}

function PriorityHero({
  urgent,
  expired,
  next,
  lead,
  refDay,
  onCook,
  onOpenItem,
}: {
  urgent: FridgeItem[];
  expired: FridgeItem[];
  next?: FridgeItem;
  lead: number;
  refDay: string;
  onCook: () => void;
  onOpenItem: (id: string) => void;
}) {
  if (urgent.length === 0 && expired.length > 0) {
    return (
      <section className="hero hero--expired">
        <div className="hero__text">
          <p className="hero__kicker">
            <Icon name="info" size={16} /> Kontrol zamanı
          </p>
          <h2 className="hero__title">{expired.length === 1 ? `Tarihi geçti: ${expired[0]!.name}` : `${expired.length} ürünün tarihi geçti`}</h2>
          <p className="hero__sub">Durumuna bak; şüpheliyse atıp listeden düş.</p>
        </div>
        <Avatars items={expired} />
        <button type="button" className="hero__cta" onClick={() => document.getElementById('grp-expired')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <Icon name="bin" size={18} /> Gözden geçir
          <Icon name="chevron" size={18} />
        </button>
      </section>
    );
  }
  if (urgent.length === 0) {
    const n = next ? daysLeft(next, refDay) : 0;
    return (
      <section className="hero hero--calm">
        <div className="hero__text">
          <p className="hero__kicker">
            <Icon name="leaf" size={16} /> Her şey yolunda
          </p>
          <h2 className="hero__title">Mutfağındakilerin hepsi taze</h2>
          {next && (
            <p className="hero__sub">
              Sıradaki: <strong>{next.name}</strong>, {n > 60 ? `${roughDuration(n)} sonra` : `${n} gün sonra`} son günü.
            </p>
          )}
        </div>
      </section>
    );
  }
  const todayCount = urgent.filter((i) => urgency(i, lead, refDay) === 'today').length;
  const first = urgent[0]!;
  // Aynı gün bitmesi gereken birden çok et/yemek: hepsi pişirilemeyebilir, biri dondurulsun.
  const meats = urgent.filter((i) => (i.category === 'et' || i.category === 'yemek') && daysLeft(i, refDay) <= 1 && freezeWorthIt(i, refDay));
  const cookable = urgent.some((i) => ['meyve', 'sebze', 'sut', 'et', 'yemek', 'firin', 'kuru', 'kuruyemis', 'sos'].includes(i.category));
  return (
    <section className={`hero ${todayCount ? 'hero--hot' : 'hero--warm'}`} aria-labelledby="hero-title">
      <div className="hero__text">
        <p className="hero__kicker">
          <Icon name="clock" size={16} /> {todayCount ? `${todayCount} ürünün bugün son günü` : 'Son günler yaklaşıyor'}
        </p>
        {expired.length > 0 && (
          <button type="button" className="hero__alert" onClick={() => document.getElementById('grp-expired')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <Icon name="info" size={14} /> {expired.length} ürünün tarihi geçti · gözden geçir
          </button>
        )}
        <h2 className="hero__title" id="hero-title">
          {urgent.length === 1 ? `${first.name} seni bekliyor` : `${urgent.length} ürün seni bekliyor`}
        </h2>
        {meats.length >= 2 && (
          <p className="hero__sub">
            {joinTr(meats.map((m) => m.name))}{' '}
            {new Set(meats.map((m) => daysLeft(m, refDay))).size === 1 ? 'aynı anda bitiyor.' : meats.length === 2 ? 'ikisinin de son günü yaklaştı.' : 'hepsinin son günü yaklaştı.'}{' '}
            {meats.every((m) => m.category === 'yemek')
              ? meats.length === 2
                ? 'İkisini birden yiyemeyeceksen birini şimdi dondur.'
                : 'Hepsini yiyemeyeceksen birini şimdi dondur.'
              : meats.length === 2
                ? 'İkisini birden pişiremeyeceksen birini şimdi dondur.'
                : 'Hepsini pişiremeyeceksen birini şimdi dondur.'}
          </p>
        )}
      </div>
      <Avatars items={urgent} label={urgent.length === 1 ? leftLabel(first, refDay) : undefined} onOpen={urgent.length === 1 ? () => onOpenItem(first.id) : undefined} />
      {/* Yalnızca tarifte kullanılabilecek bir şey varsa (cips için "ne pişirsem" denmez). */}
      {cookable && (
        <button type="button" className="hero__cta" onClick={onCook}>
          <Icon name="chef" size={18} /> Bunlarla ne pişirsem?
          <Icon name="chevron" size={18} />
        </button>
      )}
    </section>
  );
}

/** "A, B ve C" */
const joinTr = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ve ${xs[xs.length - 1]}`);

function Avatars({ items, onOpen, label }: { items: FridgeItem[]; onOpen?: () => void; label?: string }) {
  const shown = items.slice(0, 5);
  const content = (
    <>
      <span className="avatars__stack">
        {shown.map((i) => (
          <span key={i.id} className="avatars__item" style={{ background: `var(--cat-${i.category})` }}>
            <img src={foodImageUrl(i.img)} alt="" width={26} height={26} />
          </span>
        ))}
        {items.length > 5 && <span className="avatars__item avatars__more">+{items.length - 5}</span>}
      </span>
      <span className="avatars__names">
        {label ??
          (items.length <= 3
            ? joinTr(items.map((i) => i.name))
            : `${items
                .slice(0, 3)
                .map((i) => i.name)
                .join(', ')} ve ${items.length - 3} ürün`)}
      </span>
    </>
  );
  return onOpen ? (
    <button type="button" className="avatars" onClick={onOpen}>
      {content}
    </button>
  ) : (
    <div className="avatars">{content}</div>
  );
}

export function DaysBadge({ item, lead, refDay }: { item: FridgeItem; lead: number; refDay: string }) {
  const left = daysLeft(item, refDay);
  const u = urgency(item, lead, refDay);
  let big: string;
  let small: string;
  if (isStable(item)) {
    big = '∞';
    small = 'bozulmaz';
  } else if (left > 60) {
    big = roughDuration(left);
    small = 'kaldı';
  } else if (u === 'expired') {
    big = `${-left}`;
    small = 'gün geçti';
  } else if (left < 0) {
    // Dondurucuda ya da kuru gıdada kalite tarihi geçti: atma değil, önce kullan / kontrol et.
    big = '!';
    small = item.storage === 'freezer' ? 'önce kullan' : 'kontrol et';
  } else if (left === 0) {
    big = 'Bugün';
    small = 'son gün';
  } else if (left === 1) {
    big = 'Yarın';
    small = 'son gün';
  } else {
    big = `${left}`;
    small = 'gün kaldı';
  }
  return (
    <span className={`days days--${u}`}>
      <span className="days__big">{big}</span>
      <span className="days__small">{small}</span>
    </span>
  );
}

const ItemRow = memo(function ItemRow({
  item,
  lead,
  refDay,
  onOpen,
  onQuick,
  plan,
}: {
  item: FridgeItem;
  lead: number;
  refDay: string;
  onOpen: (id: string) => void;
  onQuick: (item: FridgeItem, el: HTMLElement) => void;
  /** Bu ürün için en yakın plan günü ("Pazar"). */
  plan?: string;
}) {
  const u = urgency(item, lead, refDay);
  const expired = u === 'expired';
  const w = deductWords(item);
  const level = item.opened && item.level && hasLevel(w.unit) && item.storage !== 'freezer' ? LEVEL_LABEL[item.level] : null;
  const meta = [item.quantity > 1 ? qtyText(item.quantity, w.unit) : null, STORAGES.find((s) => s.id === item.storage)!.short, item.opened ? (level ? `Açık · ${level}` : 'Açık') : null, plan ? `Plan: ${plan}` : null]
    .filter(Boolean)
    .join(' · ');
  const estimated = item.dateSource === 'auto' && !isStable(item);
  // Ne düşüleceği düğmede yazar: "1 adet / yedim", "1 şişe / bitti"; tek paket "Bitti".
  const lines: string[] = expired ? ['Karar ver'] : w.countable || item.quantity > 1 ? [w.one, w.word] : ['Bitti'];
  const quickLabel = lines.join(' ');
  return (
    <li className={`item item--${u}`}>
      <button
        type="button"
        className="item__main"
        onClick={() => onOpen(item.id)}
        aria-label={`${item.name}, ${meta}, ${leftLabel(item, refDay).toLocaleLowerCase('tr')}${estimated ? ' (tahmini)' : ''}. Ayrıntılar`}
      >
        <FoodRing img={item.img} category={item.category} ratio={remainingRatio(item, refDay)} urgency={u} size={56} />
        <span className="item__text">
          <span className="item__name">{item.name}</span>
          <span className="item__meta">
            {item.storage === 'freezer' && <Icon name="snow" size={13} />}
            <span className="item__meta-text">{meta}</span>
          </span>
        </span>
        <span className="item__when">
          <DaysBadge item={item} lead={lead} refDay={refDay} />
          {estimated && <span className="est-tag">Tahmini</span>}
        </span>
      </button>
      <button type="button" className={`item__quick ${expired ? 'is-waste' : ''}`} onClick={(e) => onQuick(item, e.currentTarget)} aria-label={`${quickLabel}: ${item.name}`}>
        <Icon name={expired ? 'info' : 'check'} size={18} stroke={2.4} />
        {lines.map((l) => (
          <span key={l} className="item__quick-line">
            {l}
          </span>
        ))}
      </button>
    </li>
  );
});
