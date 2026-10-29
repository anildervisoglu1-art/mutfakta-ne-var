import { useMemo, useRef, useState } from 'react';
import { useFridge, type ShoppingAdd } from '../store/useFridge';
import { MAX_MISSING, suggestRecipes, type Suggestion } from '../lib/suggest';
import { canFreeze, daysLeft, isBulk, isUrgent, qualityOnly, urgency } from '../lib/freshness';
import { getCatalogItem } from '../data/catalog';
import { addDays } from '../lib/dates';
import { useToday } from '../lib/useToday';
import { foodImageUrl } from '../lib/images';
import { LEVEL_LABEL, UNIT_LABEL, defaultUnit, hasLevel, isCountable, lowerLevel, qtyText, unitOf } from '../lib/units';
import { FoodTile } from '../components/Food';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { toast } from '../components/Toast';
import type { FridgeItem } from '../types';

type Filter = 'ready' | 'near';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'ready', label: 'Elimdekilerle' },
  { id: 'near', label: 'Az eksiği olanlar' },
];

/** Grubun okunuşu: "Soğan", "Soğan ya da Sarımsak", "Havuç, Patates, Kabak ya da benzeri". */
function groupLabel(group: string[]): string {
  const names = group.map((id) => getCatalogItem(id)?.name ?? id);
  if (names.length === 1) return names[0]!;
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} ya da ${names[names.length - 1]}`;
  return `${names.slice(0, 3).join(', ')} ya da benzeri`;
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('tr') + s.slice(1);

/** Eksik şart malzemeleri alışveriş listesine ekler; zaten listede olanlar (ya da yerine geçeni) yeni satır açmaz. */
function addMissingToList(s: Suggestion) {
  const { addShopping, undoShopping } = useFridge.getState();
  const added: ShoppingAdd[] = [];
  let existed = 0;
  for (const group of s.missing) {
    // Listede (alınmış ama henüz mutfağa eklenmemiş olanlar dahil) varsa yeni satır açılmaz; alındı satırı silinmez.
    const already = useFridge.getState().shopping.some((x) => x.catalogId && group.includes(x.catalogId));
    const c = getCatalogItem(group[0]);
    if (already || !c) {
      existed++;
      continue;
    }
    const r = addShopping({ name: c.name, catalogId: c.id, img: c.img, category: c.category, quantity: 1, unit: defaultUnit({ catalogId: c.id, category: c.category }) });
    if (r.existed) existed++;
    else added.push(r);
  }
  const parts = [added.length ? `${added.length} ürün listeye eklendi` : '', existed ? `${existed} ürün zaten listede` : ''].filter(Boolean);
  toast({
    text: added.length ? parts.join(', ') : 'Eksikler zaten alışveriş listende',
    tone: added.length ? 'good' : 'neutral',
    undo: added.length ? () => added.forEach((r) => undoShopping(r)) : undefined,
  });
}

export function Cook({ onAdd }: { onAdd: () => void }) {
  const items = useFridge((s) => s.items);
  const settings = useFridge((s) => s.settings);
  const ref = useToday();
  const suggestions = useMemo(() => suggestRecipes(items, settings.leadDays, ref), [items, settings.leadDays, ref]);
  const ready = suggestions.filter((s) => s.missing.length === 0);
  const near = suggestions.filter((s) => s.missing.length > 0 && s.missing.length <= MAX_MISSING);
  const [chosen, setChosen] = useState<Filter | null>(null);
  const filter: Filter = chosen ?? (ready.length ? 'ready' : 'near');
  const visible = filter === 'ready' ? ready : near;
  // Tarifte kullanılabilecek acil ürünler (cips, bisküvi gibi atıştırmalıklar "pişirilmez").
  const urgent = items
    .filter((i) => isUrgent(i, settings.leadDays, ref) && !['atistirmalik', 'icecek'].includes(i.category))
    .sort((a, b) => daysLeft(a, ref) - daysLeft(b, ref));
  const [openId, setOpenId] = useState<string | null>(null);
  const [cooking, setCooking] = useState<Suggestion | null>(null);
  // İlk tarif yalnızca bir şeyi değerlendiriyorsa kendiliğinden açılır.
  const expandedId = openId ?? (visible[0]?.rescues ? visible[0].recipe.id : null);

  return (
    <main className="screen">
      <header className="page-head">
        <p className="eyebrow">Elindekini değerlendir</p>
        <h1 className="display">Ne pişirsem?</h1>
      </header>

      {urgent.length > 0 && (
        <section className="urgent-strip" aria-label="Önce kullanılacaklar">
          <p>Önce bunları kullan:</p>
          <div className="urgent-strip__list">
            {urgent.map((i) => {
              // Hiçbir tarifte geçmeyen ama dondurulabilen ürün için tek dokunuşla dondur.
              const unused = !suggestions.some((s) => s.uses.some((x) => x.id === i.id));
              return (
                <span key={i.id} className={`u-chip when--${urgency(i, settings.leadDays, ref)}`}>
                  <img src={foodImageUrl(i.img)} alt="" width={20} height={20} />
                  {i.name}
                  {unused && !canFreeze(i, ref) && <small className="u-chip__hint">{finishHint(i, ref)}</small>}
                  {unused && canFreeze(i, ref) && (
                    <button
                      type="button"
                      className="u-chip__act"
                      onClick={() => {
                        const before = useFridge.getState().items;
                        useFridge.getState().freeze(i.id);
                        toast({ text: `${i.name} dondurucuya taşındı`, tone: 'good', undo: () => useFridge.setState({ items: before }) });
                      }}
                    >
                      <Icon name="snow" size={14} /> Dondur
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {suggestions.length === 0 ? (
        <div className="empty-card">
          <span className="empty-card__art">
            <FoodTile img="🍳" category="sut" size={72} />
          </span>
          <h2>Henüz öneri yok</h2>
          <p>
            {items.length
              ? 'Elindekilerle eşleşen tarif yok. Birkaç taze ürün (sebze, yumurta, et) ekleyince öneriler burada çıkar.'
              : 'Mutfağına birkaç ürün ekle; elindekilerle yapabileceğin tarifleri, son günü yaklaşanlar önde olacak şekilde gösterelim.'}
          </p>
          <button type="button" className="btn btn--primary" onClick={onAdd}>
            <Icon name="plus" size={18} stroke={2.5} /> Ürün ekle
          </button>
        </div>
      ) : (
        <>
          <div className="chips cook-filter" role="group" aria-label="Tarifleri süz">
            {FILTERS.map((f) => {
              const n = f.id === 'ready' ? ready.length : near.length;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  className={`chip ${filter === f.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setChosen(f.id);
                    setOpenId(null);
                  }}
                >
                  {f.label}
                  <span className="chip__count">{n}</span>
                </button>
              );
            })}
          </div>
          {visible.length === 0 && (
            <p className="cook-empty">
              {filter === 'ready' ? 'Şu an bütün şart malzemeleri elinde olan tarif yok. "Az eksiği olanlar"a göz at.' : '1–2 malzemesi eksik tarif yok.'}
            </p>
          )}
          <ul className="recipes">
            {visible.map((s) => {
              const expanded = expandedId === s.recipe.id;
              return (
                <li key={s.recipe.id} className={`recipe ${expanded ? 'is-open' : ''}`}>
                  <button type="button" className="recipe__head" onClick={() => setOpenId(expanded ? '' : s.recipe.id)} aria-expanded={expanded}>
                    <FoodTile img={s.recipe.img} category="yemek" size={56} />
                    <span className="recipe__text">
                      <span className="recipe__name">{s.recipe.name}</span>
                      <span className="recipe__meta">
                        <Icon name="clock" size={14} /> {s.recipe.minutes} dk
                        {s.missing.length > 0 && <span className="pill pill--miss">{s.missing.length} malzeme eksik</span>}
                        {s.rescues > 0 && <span className="pill pill--save">Son günü yaklaşan {s.rescues} ürünü değerlendirir</span>}
                      </span>
                    </span>
                    <Icon name="chevron" size={20} className="recipe__chev" />
                  </button>
                  <div className="recipe__ings">
                    {s.uses.map((i) => (
                      <span key={i.id} className={`ing ing--have when--${i.storage === 'freezer' ? 'frozen' : urgency(i, settings.leadDays, ref)}`}>
                        {i.storage === 'freezer' ? <Icon name="snow" size={16} /> : <img src={foodImageUrl(i.img)} alt="" width={22} height={22} />}
                        {i.name}
                        {i.storage === 'freezer' && <small> (dondurucuda)</small>}
                      </span>
                    ))}
                    {s.missing.map((g) => {
                      const c = getCatalogItem(g[0]);
                      return (
                        <span key={g.join()} className="ing ing--missing">
                          {c && <img src={foodImageUrl(c.img)} alt="" width={22} height={22} />}
                          {groupLabel(g)}
                          <small className="ing__tag">eksik</small>
                        </span>
                      );
                    })}
                  </div>
                  {expanded && (
                    <div className="recipe__body">
                      <p>{s.recipe.how}</p>
                      {(s.recipe.id === 'kalan-yemek' ? s.uses.slice(0, 1) : s.uses).some((i) => i.storage === 'freezer') && <p className="recipe__missing">Dondurucudakileri bir gece önceden buzdolabında çözdür.</p>}
                      {s.missing.length > 0 ? (
                        <div className="recipe__need">
                          <p className="recipe__need-text">
                            <strong>Eksik (gerekli):</strong> {s.missing.map(groupLabel).join('; ')}
                          </p>
                          <button type="button" className="btn btn--soft btn--block" onClick={() => addMissingToList(s)}>
                            <Icon name="plus" size={18} stroke={2.5} /> Eksikleri listeye ekle
                          </button>
                        </div>
                      ) : (
                        <p className="recipe__missing recipe__ok">
                          <Icon name="check" size={14} stroke={3} /> Gerekli malzemelerin hepsi elinde.
                        </p>
                      )}
                      {s.optionalMissing.length > 0 && (
                        <p className="recipe__missing">
                          <strong>İsteğe bağlı:</strong> {s.optionalMissing.map(groupLabel).join('; ')} (olmasa da olur)
                        </p>
                      )}
                      {s.recipe.staples && <p className="recipe__missing recipe__staples">{capitalize(s.recipe.staples)} gibi temel malzemeler evde var sayıldı.</p>}
                      <button type="button" className="btn btn--primary btn--block" onClick={() => setCooking(s)}>
                        <Icon name="chef" size={18} /> {reusesLeftovers(s) ? 'Bunu yedik' : 'Bunu pişirdim'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className="list-end" />

      <Sheet open={!!cooking} onClose={() => setCooking(null)} label="Pişirdim">
        {cooking && (
          <CookedForm
            s={cooking}
            onDone={(plan, leftover) => {
              applyCooked(cooking, plan, leftover, ref);
              setCooking(null);
            }}
          />
        )}
      </Sheet>
    </main>
  );
}

/** Tarifte geçmeyen acil ürün için kısa öneri. Uzun ömürlü/kalite tarihli ürüne "bugün bitir" denmez. */
const finishHint = (i: FridgeItem, ref: string) => {
  const left = daysLeft(i, ref);
  if (qualityOnly(i) || left < 0) return 'kontrol et';
  return left === 0 ? 'bugün bitir' : left === 1 ? 'yarına kadar bitir' : `${left} gün içinde bitir`;
};
/** Yeni pişen yemeğin artanı: salata 2, diğerleri 3 gün. */
const leftoverDays = (s: Suggestion) => (/salata/i.test(s.recipe.name) ? 2 : 3);
/** Artık yemekten yapılan tarifte "artan" yeni bir yemek değildir: kalan porsiyon zaten eski tarihiyle mutfakta durur. */
// Yalnızca "Artıkları Değerlendir": artığı malzeme olarak kullanan yeni bir yemek (Fırında Makarna) yeni yemektir.
const reusesLeftovers = (s: Suggestion) => s.recipe.id === 'kalan-yemek';

/** Pişirince ürün başına seçim: sayılan üründe kaç tane kullanıldı; paket/kapta değişmedi / biraz / bitti (1 paket). */
type Choice = { kind: 'count'; n: number } | { kind: 'pkg'; v: 'same' | 'some' | 'done' };
type Plan = [string, Choice][];

/** "Biraz kullandım" yapılabilir mi: dondurucuda değil, açık paketse daha "Az kaldı"ya inmemiş. */
const canUseSome = (i: FridgeItem) => i.storage !== 'freezer' && hasLevel(unitOf(i)) && !(i.opened && i.level === 'low');

function defaultChoice(i: FridgeItem): Choice {
  const unit = unitOf(i);
  if (isCountable(unit)) {
    // Tek ekmek, tek simit bir yemekte bitmez; tek demet ıspanak, tek domates biter.
    const n = i.quantity === 1 && !['meyve', 'sebze', 'et', 'yemek'].includes(i.category) ? 0 : 1;
    return { kind: 'count', n: Math.min(n, i.quantity) };
  }
  if (i.category === 'yemek' || i.category === 'et') return { kind: 'pkg', v: 'done' };
  if (isBulk(i) || !canUseSome(i)) return { kind: 'pkg', v: 'same' };
  return { kind: 'pkg', v: 'some' };
}

/** Kaydetmeden önce gösterilen değişiklik: "10 adet → 8 adet", "açık şişe · Tam → Yarım", "değişmedi". */
function changeText(i: FridgeItem, c: Choice): { text: string; changed: boolean } {
  const unit = unitOf(i);
  const q = i.quantity;
  if (c.kind === 'count') {
    if (c.n <= 0) return { text: `${qtyText(q, unit)} · değişmedi`, changed: false };
    return { text: c.n >= q ? `${qtyText(q, unit)} → bitti` : `${qtyText(q, unit)} → ${qtyText(q - c.n, unit)}`, changed: true };
  }
  if (c.v === 'same') return { text: `${qtyText(q, unit)}${i.opened ? ` · açık · ${LEVEL_LABEL[i.level ?? 'full']}` : ''} · değişmedi`, changed: false };
  if (c.v === 'done') return { text: q > 1 ? `${qtyText(q, unit)} → ${qtyText(q - 1, unit)}` : `${qtyText(1, unit)} → bitti`, changed: true };
  if (i.opened) return { text: `açık ${UNIT_LABEL[unit]} · ${LEVEL_LABEL[i.level ?? 'full']} → ${LEVEL_LABEL[lowerLevel(i.level)]}`, changed: true };
  return { text: q > 1 ? `${qtyText(q, unit)} → 1 ${UNIT_LABEL[unit]} açılır · ${LEVEL_LABEL.half}` : `${UNIT_LABEL[unit]} açılır · ${LEVEL_LABEL.half} kalır`, changed: true };
}

/** Gösterilen değişiklikleri uygular; tek "Geri al" bütün satırları, açılan paketleri ve artan yemeği geri getirir. */
function applyCooked(s: Suggestion, plan: Plan, leftover: number, ref: string) {
  const st = useFridge.getState();
  const snapshots: FridgeItem[] = [];
  const historyIds: string[] = [];
  const created: string[] = [];
  let changed = 0;
  for (const [id, c] of plan) {
    const items = useFridge.getState().items;
    const it = items.find((i) => i.id === id);
    if (!it) continue;
    if (c.kind === 'count' || c.v === 'done') {
      const n = c.kind === 'count' ? Math.min(c.n, it.quantity) : 1;
      if (n <= 0) continue;
      snapshots.push({ ...it });
      // 0'a inen ürün satırdan kalkar; tek geçmiş kaydı oluşur.
      const h = st.finish(id, 'eaten', n);
      if (h) historyIds.push(h);
      changed++;
    } else if (c.v === 'some') {
      if (!canUseSome(it)) continue;
      const r = st.useSome(id);
      if (!r) continue;
      snapshots.push({ ...it });
      if (r.created) created.push(r.id);
      else if (r.merged) {
        // Açılan paket var olan bir açık satıra eklendiyse o satırın önceki hâli de saklanır.
        const twin = items.find((i) => i.id === r.id);
        if (twin) snapshots.push({ ...twin });
      }
      changed++;
    }
  }
  let undoLeftover: (() => void) | undefined;
  if (leftover > 0) {
    const c = getCatalogItem('ev-yemegi')!;
    const r = st.add({
      catalogId: c.id,
      name: s.recipe.name,
      img: s.recipe.img,
      category: 'yemek',
      storage: 'fridge',
      quantity: leftover,
      unit: 'kap',
      opened: false,
      useBy: addDays(ref, leftoverDays(s)),
      dateSource: 'auto',
      cookedAt: ref,
      fromRecipe: true,
    });
    // Önceki artanla birleştiyse yalnızca bu porsiyonları geri al.
    undoLeftover = r.merged ? () => useFridge.getState().update(r.item.id, { quantity: r.prevQuantity }) : () => useFridge.getState().remove(r.item.id);
  }
  const parts = [changed ? `${changed} ürün güncellendi` : 'Hiçbir ürün değişmedi'];
  if (leftover > 0) parts.push(`artan ${qtyText(leftover, 'kap')} yemek buzdolabına eklendi`);
  toast({
    text: `Afiyet olsun! ${parts.join(', ')}.`,
    tone: 'good',
    undo:
      changed || undoLeftover
        ? () => {
            undoLeftover?.();
            const { remove, restore } = useFridge.getState();
            created.forEach((id) => remove(id));
            // Ters sırada: aynı satır iki kez değiştiyse en eski hâli kalır.
            [...snapshots].reverse().forEach((sn, i) => restore(sn, i === 0 ? historyIds : []));
          }
        : undefined,
  });
}

function CookedForm({ s, onDone }: { s: Suggestion; onDone: (plan: Plan, leftover: number) => void }) {
  // Artıklardan yapılan öğünde yalnızca en acil artan (ilk sıradaki) bitti sayılır; diğerleri değişmeden başlar.
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(s.uses.map((u, idx) => [u.id, reusesLeftovers(s) && u.category === 'yemek' && idx > 0 ? ((isCountable(unitOf(u)) ? { kind: 'count', n: 0 } : { kind: 'pkg', v: 'same' }) as Choice) : defaultChoice(u)])),
  );
  const set = (id: string, c: Choice) => setChoices((a) => ({ ...a, [id]: c }));
  const submitted = useRef(false);
  const leftoversOnly = reusesLeftovers(s);
  const [leftover, setLeftover] = useState(0);
  const changes = s.uses.filter((u) => changeText(u, choices[u.id]!).changed).length;
  return (
    <div className="cooked">
      <h2 className="sheet-title">{leftoversOnly ? 'Afiyet olsun!' : 'Ellerine sağlık!'}</h2>
      <p className="sheet-sub">Ne kadar kullandın? Kaydetmeden önce mutfağında neyin değişeceğini gör.</p>
      <ul className="check-list">
        {s.uses.map((i) => {
          const c = choices[i.id]!;
          const ch = changeText(i, c);
          const unit = unitOf(i);
          return (
            <li key={i.id} className={`cooked-row ${ch.changed ? 'is-changed' : ''}`}>
              <div className="cooked-row__top">
                <FoodTile img={i.img} category={i.category} size={40} />
                <span className="use-row__name">
                  {i.name}
                  <small className="cooked-row__change" aria-live="polite">
                    {ch.text}
                  </small>
                </span>
                {c.kind === 'count' && (
                  <span className="cooked-row__step">
                    <Stepper value={c.n} min={0} max={i.quantity} onChange={(v) => set(i.id, { kind: 'count', n: v })} label={`${i.name}: kaç ${UNIT_LABEL[unit]} kullandın`} />
                  </span>
                )}
              </div>
              {c.kind === 'pkg' && (
                <div className="cooked-choice" role="radiogroup" aria-label={`${i.name} ne oldu`}>
                  {(
                    [
                      ['same', 'Değişmedi'],
                      ['some', i.category === 'yemek' ? 'Biraz yedik' : 'Biraz kullandım'],
                      ['done', i.quantity > 1 ? `1 ${UNIT_LABEL[unit]} bitti` : 'Bitti'],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={c.v === v}
                      className={`cooked-choice__opt ${c.v === v ? 'is-active' : ''}`}
                      disabled={v === 'some' && !canUseSome(i)}
                      onClick={() => set(i.id, { kind: 'pkg', v })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {!leftoversOnly && (
          <li className={`cooked-row ${leftover ? 'is-changed' : ''}`}>
            <div className="cooked-row__top">
              <button type="button" className={`check-row cooked-left ${leftover ? 'is-on' : ''}`} onClick={() => setLeftover((v) => (v ? 0 : 1))} aria-pressed={leftover > 0}>
                <FoodTile img={s.recipe.img} category="yemek" size={40} />
                <span className="use-row__name">
                  Artan yemeği kaydet
                  <small>{leftover ? `${qtyText(leftover, 'kap')} buzdolabına eklenecek · ${leftoverDays(s)} gün dayanır` : `${leftoverDays(s)} gün dayanır`}</small>
                </span>
                <span className="check-row__box">{leftover > 0 && <Icon name="check" size={16} stroke={3} />}</span>
              </button>
            </div>
            {leftover > 0 && (
              <div className="cooked-left__qty">
                <span>Kaç kap?</span>
                <Stepper value={leftover} min={1} max={9} onChange={setLeftover} label="Artan yemek kaç kap" />
              </div>
            )}
          </li>
        )}
      </ul>
      <p className="cooked-summary">{changes ? `Kaydedince ${changes} ürün güncellenecek.` : 'Hiçbir ürün değişmeyecek.'}</p>
      <button
        type="button"
        className="btn btn--primary btn--lg btn--block"
        onClick={() => {
          // Çift tıklama malzemeleri iki kez düşmesin.
          if (submitted.current) return;
          submitted.current = true;
          onDone(Object.entries(choices), leftover);
        }}
      >
        Kaydet
      </button>
    </div>
  );
}
