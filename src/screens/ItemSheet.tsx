import { useEffect, useRef, useState } from 'react';
import { PlanForm } from '../components/PlanForm';
import { planDayLabel, planIdeas } from '../lib/plans';
import { MAX_QTY, useFridge } from '../store/useFridge';
import { getCatalogItem, storageName } from '../data/catalog';
import {
  canFreeze,
  canOpen,
  canThaw,
  daysLeft,
  finishVerb,
  freezeAdvice,
  isStable,
  leftLabel,
  qualityOnly,
  remainingRatio,
  shouldSuggestFreezing,
  urgency,
  urgencyTitle,
  useByIfMovedToFridge,
} from '../lib/freshness';
import { isDay } from '../lib/validate';
import { addDays, diffDays, longDate, roughDuration } from '../lib/dates';
import { useToday } from '../lib/useToday';
import { hasLevel, LEVEL_LABEL, qtyText, UNIT_LABEL } from '../lib/units';
import { FoodRing } from '../components/Food';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { DayChoice } from '../components/DayChoice';
import { Segmented, Stepper } from '../components/Stepper';
import { clearToast, toast } from '../components/Toast';
import { addItemToShopping, deductWords, undoFinish } from './Home';
import type { Changed } from '../store/useFridge';
import type { DayString, FridgeItem, Level, PackageKind } from '../types';

type DateField = 'boughtAt' | 'openedAt' | 'cookedAt';

const DAY_QUESTION: Record<DateField, string> = {
  boughtAt: 'Ne zaman aldın?',
  openedAt: 'Ne zaman açtın?',
  cookedAt: 'Ne zaman pişirdin?',
};
const DAY_NAME: Record<DateField, string> = {
  boughtAt: 'Alındı',
  openedAt: 'Açıldı',
  cookedAt: 'Pişirildi',
};
const KIND_LABEL: Record<PackageKind, string> = {
  stt: 'STT',
  tett: 'TETT',
  unknown: 'türü bilinmiyor',
};
const UNKNOWN_KIND_NOTE = 'Tarihin türü bilinmiyor; ürünü kontrol et, şüphedeysen tüketme.';

/** "Bugün", "Dün", "5 gün önce". */
const agoText = (day: DayString, ref: DayString) => {
  const n = diffDays(ref, day);
  return n <= 0 ? 'Bugün' : n === 1 ? 'Dün' : `${n} gün önce`;
};

export function ItemSheet({ id, onClose, onShow }: { id: string | null; onClose: () => void; onShow?: (id: string) => void }) {
  const item = useFridge((s) => s.items.find((i) => i.id === id));
  const settings = useFridge((s) => s.settings);
  const ref = useToday();
  // Listeden yeni bir ürün açılınca önceki ürünün "Geri al"ı bu panelde kalmasın (yanlış ürünü geri almasın).
  // Aynı panelde yığından ayrılan pakete geçerken (onShow) bildirim korunur.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (id && !wasOpen.current) clearToast();
    wasOpen.current = !!id;
  }, [id]);

  /** Yığından ayrılan paketi (ör. yeni açılan) aynı panelde göster. */
  const show = (next: string) => {
    if (!onShow) return onClose();
    onShow(next);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.sheet')?.focus({ preventScroll: true }));
  };

  return (
    <Sheet open={!!item} onClose={onClose} label={item?.name ?? ''}>
      {item && <Detail key={item.id} item={item} lead={settings.leadDays} refDay={ref} close={onClose} show={show} />}
    </Sheet>
  );
}

/** Tarih düzenlemesinin geri alınmasında yalnızca bunlar eski hâline döner. */
const DATE_FIELDS = ['useBy', 'baseUseBy', 'boughtAt', 'openedAt', 'cookedAt', 'dateSource', 'packageKind'] as const;

function Detail({ item, lead, refDay, close, show }: { item: FridgeItem; lead: number; refDay: string; close: () => void; show: (id: string) => void }) {
  const { finish, remove, restore, open, freeze, moveToFridge, thaw, update, setQuantity, useSome, setDates, setPackageDate, setManualDate } = useFridge.getState();
  const [editDate, setEditDate] = useState(false);
  const [wasteChoice, setWasteChoice] = useState(false);
  const [editing, setEditing] = useState<DateField | null>(null);
  const [planning, setPlanning] = useState(false);
  const allPlans = useFridge((s) => s.plans);
  const myPlans = allPlans.filter((p) => p.itemId === item.id);
  const [dateMode, setDateMode] = useState<'package' | 'manual' | ''>(item.dateSource === 'package' ? 'package' : item.dateSource === 'manual' ? 'manual' : '');
  const [kind, setKind] = useState<PackageKind>(item.packageKind ?? 'unknown');
  // Geri al ya da başka sekmeden gelen değişiklikte seçici kayıtla aynı kalsın (STT sessizce TETT'ye dönmesin).
  useEffect(() => {
    setKind(item.dateSource === 'package' ? (item.packageKind ?? 'unknown') : 'unknown');
    setDateMode(item.dateSource === 'package' ? 'package' : item.dateSource === 'manual' ? 'manual' : '');
  }, [item.dateSource, item.packageKind]);
  /** Yazarak miktar girilirken her tuş ayrı geri alma olmasın: düzenlemenin başındaki hâl. */
  const qtyBase = useRef<{
    value: number;
    snap: FridgeItem;
    timer?: number;
  } | null>(null);

  /** Başka bir eylem miktar düzenlemesini bitirir (geri alma o düzenlemeye karışmasın). */
  const endQtyEdit = () => {
    if (qtyBase.current) window.clearTimeout(qtyBase.current.timer);
    qtyBase.current = null;
  };
  /** Tarih düzenlemesini geri al: yalnızca tarih alanları eski hâline döner, miktar (başka sekmede değişmiş olabilir) korunur. */
  const undoDates = (prev: FridgeItem) =>
    useFridge.setState((s) => ({
      items: s.items.map((i) => {
        if (i.id !== prev.id) return i;
        const next: FridgeItem = { ...i };
        for (const f of DATE_FIELDS) {
          if (prev[f] === undefined) delete next[f];
          else (next as unknown as Record<string, unknown>)[f] = prev[f];
        }
        return next;
      }),
    }));

  const verb = finishVerb(item);
  const w = deductWords(item);
  const stable = isStable(item);
  const fridgeUseBy = useByIfMovedToFridge(item, refDay);
  const u = urgency(item, lead, refDay);
  const left = daysLeft(item, refDay);
  const cat = getCatalogItem(item.catalogId);
  const snapshot = { ...item };
  const expired = u === 'expired';
  const ago = diffDays(refDay, item.addedAt);
  /** Tarihi geçince tüketilmemesi gerekenler (Listeria vb. iz bırakmaz). */
  const pkgKind: PackageKind | undefined = item.dateSource === 'package' ? (item.packageKind ?? 'unknown') : undefined;
  // Kapalı kavanoz/konserve/UHT'nin tarihi kalite tarihidir; açılınca sıradan bozulabilir ürün olur. Paketteki STT her zaman katıdır.
  const strict =
    expired &&
    (pkgKind === 'stt' ||
      ((['et', 'yemek', 'sut', 'sos', 'icecek'].includes(item.category) || item.catalogId === 'bebek-mamasi') &&
        !(cat?.tett && !item.opened) &&
        item.catalogId !== 'sut-tozu' &&
        !['kasar', 'tereyagi', 'zeytin', 'yumurta'].includes(item.catalogId ?? '')));
  const isEgg = item.catalogId === 'yumurta';
  const sttPassed = expired && pkgKind === 'stt';
  const softPast = left < 0 && !expired && qualityOnly(item);
  const many = item.quantity > 1;
  const frozen = item.storage === 'freezer';
  /** Kap/şişe/paket: "Biraz kullandım" ve doluluk. */
  const levelled = hasLevel(w.unit) && !frozen;
  const canUseSome = levelled && !expired && !stable;
  const verbLower = verb === 'Yedim' ? 'yedim' : verb === 'Kullandım' ? 'kullandım' : 'bitti';
  const shortened = item.opened && !frozen && item.baseUseBy !== undefined && item.baseUseBy !== item.useBy;

  /** Tek bir eylem (Açtım/Dondur/…) ve geri alma. Yığından ayrılan satır: `follow` ise panel onu gösterir, değilse kapanır. */
  const act = (fn: (id: string) => Changed | undefined, text: (now: FridgeItem) => string, follow = false) => {
    endQtyEdit();
    const prevSrc = { ...item };
    const changed = fn(item.id);
    if (!changed) return;
    const now = useFridge.getState().items.find((i) => i.id === changed.id);
    // Geri al yalnızca bu eylemin yaptığını tersine çevirir: ayrılan paket kaynağa geri eklenir; başka sekmede yenen/değişen korunur.
    const giveBack = (items: FridgeItem[], q: number) => {
      if (q <= 0) return items;
      return items.some((i) => i.id === prevSrc.id) ? items.map((i) => (i.id === prevSrc.id ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + q) } : i)) : [...items, { ...prevSrc, quantity: q }];
    };
    toast({
      text: now ? text(now) : 'Tamam',
      tone: 'good',
      undo: () =>
        useFridge.setState((s) => {
          if (changed.created) {
            const piece = s.items.find((i) => i.id === changed.id);
            return { items: giveBack(s.items.filter((i) => i.id !== changed.id), piece?.quantity ?? 0) };
          }
          if (changed.merged) {
            const twin = s.items.find((i) => i.id === changed.id);
            if (!twin) return s;
            const rest = twin.quantity > 1 ? s.items.map((i) => (i.id === twin.id ? { ...i, quantity: i.quantity - 1 } : i)) : s.items.filter((i) => i.id !== twin.id);
            return { items: giveBack(rest, 1) };
          }
          // Yerinde değişti (tek paket): eski hâli, güncel miktarla.
          return { items: s.items.map((i) => (i.id === prevSrc.id ? { ...prevSrc, quantity: i.quantity } : i)) };
        }),
    });
    if (changed.created || changed.merged) follow ? show(changed.id) : close();
  };

  const done = (outcome: 'eaten' | 'wasted', quantity?: number) => {
    endQtyEdit();
    const hid = finish(item.id, outcome, quantity);
    // Kapanırken ikinci dokunuş: ürün zaten düşüldü, ikinci bir kayıt/bildirim oluşmasın.
    if (!hid) return;
    const partial = quantity !== undefined && quantity < item.quantity;
    const rest = qtyText(item.quantity - (quantity ?? item.quantity), w.unit);
    toast({
      text:
        outcome === 'eaten'
          ? partial
            ? `${item.name}: ${w.one} ${w.past}, ${rest} kaldı`
            : w.word === 'yedim'
              ? `${item.name} bitti, afiyet olsun!`
              : `${item.name} bitti`
          : partial
            ? `${item.name}: ${w.one} atıldı, ${rest} kaldı`
            : `${item.name} atıldı olarak kaydedildi`,
      tone: outcome === 'eaten' ? 'good' : 'neutral',
      undo: () => undoFinish(snapshot, hid),
      action: partial ? undefined : { label: 'Listeye ekle', run: () => addItemToShopping(snapshot, () => undoFinish(snapshot, hid)) },
    });
    setWasteChoice(false);
    if (!partial) close();
  };

  const changeQty = (quantity: number) => {
    // Ürün bu arada bittiyse (ör. aynı değişiklik ikinci kez geldi) hiçbir şey yapma.
    if (!useFridge.getState().items.some((i) => i.id === item.id)) return;
    // Eski "Geri al" bu değişikliği geri almasın; miktarın kendi geri alması olsun.
    clearToast();
    if (!qtyBase.current) qtyBase.current = { value: item.quantity, snap: { ...item } };
    const base = qtyBase.current;
    window.clearTimeout(base.timer);
    base.timer = window.setTimeout(() => qtyBase.current === base && (qtyBase.current = null), 1500);
    const hid = setQuantity(item.id, quantity);
    if (quantity <= 0) {
      // 0: ürün biter, tek bir "bitti" kaydı oluşur; geri al hem ürünü hem kaydı geri getirir.
      window.clearTimeout(base.timer);
      qtyBase.current = null;
      toast({
        text: `${item.name} bitti`,
        tone: 'good',
        undo: () => restore(base.snap, [hid]),
        action: {
          label: 'Listeye ekle',
          run: () => addItemToShopping(base.snap, () => restore(base.snap, [hid])),
        },
      });
      close();
      return;
    }
    toast({
      text: `Miktar: ${qtyText(base.value, w.unit)} → ${qtyText(quantity, w.unit)}`,
      // Fark kadar geri alınır: arada başka sekmede yenen korunur.
      undo: () => {
        const cur = useFridge.getState().items.find((i) => i.id === item.id);
        if (!cur) return;
        update(item.id, { quantity: Math.max(1, Math.min(MAX_QTY, cur.quantity - (quantity - base.value))) });
      },
    });
  };

  const changeDay = (field: DateField, day: DayString | null) => {
    endQtyEdit();
    const before = { ...item };
    setDates(item.id, { [field]: day } as Parameters<typeof setDates>[1]);
    const now = useFridge.getState().items.find((i) => i.id === item.id);
    toast({
      text: `${DAY_NAME[field]}: ${day ? agoText(day, refDay) : 'kaldırıldı'}${now ? ` · ${leftLabel(now, refDay).toLocaleLowerCase('tr')}` : ''}`,
      tone: 'good',
      undo: () => undoDates(before),
    });
  };

  const applyPackage = (day: DayString, k: PackageKind) => {
    endQtyEdit();
    const before = { ...item };
    setPackageDate(item.id, day, k);
    toast({
      text: `Paketteki tarih (${k === 'unknown' ? 'türü bilinmiyor' : k.toUpperCase()}): ${longDate(day, refDay)}`,
      tone: 'good',
      undo: () => undoDates(before),
    });
  };

  const applyManual = (day: DayString) => {
    if (day === item.useBy && item.dateSource === 'manual') return;
    endQtyEdit();
    const before = { ...item };
    setManualDate(item.id, day);
    toast({
      text: `Tarih güncellendi: ${longDate(day, refDay)}`,
      tone: 'good',
      undo: () => undoDates(before),
    });
  };

  const wasteButtons =
    item.quantity > 1 && wasteChoice ? (
      <div className="btn-row">
        <button type="button" className="btn btn--soft btn--lg btn--warn" onClick={() => done('wasted', 1)}>
          {w.one} attım
        </button>
        <button type="button" className="btn btn--danger btn--lg" onClick={() => done('wasted')}>
          Hepsini attım ({item.quantity})
        </button>
      </div>
    ) : null;

  const onWaste = () => (item.quantity > 1 ? setWasteChoice(true) : done('wasted'));

  const remaining = expired ? 'Süre doldu' : stable ? 'Bozulmaz' : left < 0 ? 'Kalite tarihi geçti' : left === 0 ? 'Bugün' : left === 1 ? '1 gün' : left > 60 ? roughDuration(left) : `${left} gün`;
  const dayFields: DateField[] = [item.category === 'yemek' ? 'cookedAt' : 'boughtAt', ...(item.opened && !frozen ? (['openedAt'] as const) : [])];
  const dayValue = (f: DateField): DayString | undefined => (f === 'cookedAt' ? (item.cookedAt ?? item.addedAt) : item[f]);

  return (
    <div className={`detail detail--${u}`}>
      <div className="detail__hero">
        <FoodRing img={item.img} category={item.category} ratio={remainingRatio(item, refDay)} urgency={u} size={96} />
        <div className="detail__head-text">
          <h2 className="detail__name">{item.name}</h2>
          <p className={`detail__status status--${u}`}>{urgencyTitle(item, lead, refDay)}</p>
          {(stable || expired || u !== 'fresh' || left < 7) && (
            <p className="detail__date">
              {stable ? (
                'Tuz, şeker, bal ve buz gibi ürünlere uyarı vermeyiz.'
              ) : left < 0 ? (
                <>
                  {-left} gün önceydi
                  <br />
                  <span className="nowrap">{longDate(item.useBy, refDay)}</span>
                </>
              ) : (
                <span className="nowrap">{longDate(item.useBy, refDay)}</span>
              )}
            </p>
          )}
          {!stable && (
            <p className="detail__source">
              {item.dateSource === 'auto' ? (
                <>
                  <span className="est-tag">Tahmini</span> ortalama saklama süresi
                </>
              ) : item.dateSource === 'package' ? (
                `Paketteki tarih · ${KIND_LABEL[pkgKind ?? 'unknown']}`
              ) : (
                'Elle girildi'
              )}
              {shortened && ' · açıldığı için kısaldı'}
            </p>
          )}
        </div>
      </div>

      {expired && (
        <p className="note note--warn">
          <Icon name="info" size={18} />
          <span>
            {sttPassed
              ? 'Paketteki son tüketim tarihi (STT) geçti: tüketme.'
              : item.catalogId === 'bebek-mamasi'
                ? 'Açıldıktan sonraki süre doldu; bebek için kullanma.'
                : pkgKind === 'unknown'
                  ? UNKNOWN_KIND_NOTE
                  : strict
                    ? 'Tarih geçti. Bu tür ürünlerde bozulma kokudan anlaşılmayabilir; tüketme.'
                    : isEgg
                      ? 'Kırarak kontrol et; yalnızca iyice pişirerek kullan, çiğ ya da az pişmiş tüketme.'
                      : `${item.dateSource === 'auto' ? 'Tahmini süre doldu.' : 'Son gün geçti.'} Görünüşü, kokusu ya da dokusu değiştiyse ya da şüphedeysen tüketme.`}
          </span>
        </p>
      )}

      {softPast && (
        <p className="note note--tip">
          <Icon name="info" size={18} />
          <span>
            {frozen
              ? 'Dondurucuda kalite süresi doldu: tadı ve dokusu bozulmuş olabilir. Kontrol et, yakında pişir.'
              : pkgKind === 'tett'
                ? 'Tavsiye edilen tüketim tarihi (TETT) geçti: kalitesi düşmüş olabilir. Ambalajını, kokusunu ve görünüşünü kontrol et; şüphedeysen tüketme.'
                : pkgKind === 'unknown'
                  ? UNKNOWN_KIND_NOTE
                  : item.category === 'sos' || item.catalogId === 'sut-uht' || item.category === 'icecek'
                    ? 'Bu genellikle bir kalite tarihidir (TETT). Kapağı şişmiş, kutusu paslı/ezik ya da küflüyse tüketme; şüphedeysen tüketme.'
                    : 'Bu bir kalite tarihi. Bayatlamış ya da acılaşmış olabilir: koklayıp kontrol et; küf ya da böcek varsa at.'}
          </span>
        </p>
      )}

      {item.thawed && item.category === 'et' && (
        <p className="note note--tip">
          <Icon name="snow" size={18} />
          <span>Çözülen çiğ eti tekrar dondurma; pişirdikten sonra dondurabilirsin.</span>
        </p>
      )}

      {shouldSuggestFreezing(item, refDay) && (
        <p className="note note--tip">
          <Icon name="snow" size={18} />
          <span>{freezeAdvice(item, refDay)}</span>
        </p>
      )}

      <dl className="facts">
        <div>
          <dt>Yer</dt>
          <dd>
            {frozen && <Icon name="snow" size={14} />} {storageName(item.storage)}
          </dd>
        </div>
        <div>
          <dt>Eklendi</dt>
          <dd>{ago <= 0 ? 'Bugün' : ago === 1 ? 'Dün' : `${ago} gün önce`}</dd>
        </div>
        {dayFields.map((f) => {
          const v = dayValue(f);
          return (
            <div key={f} className={`fact--edit ${editing === f ? 'is-active' : ''}`}>
              <dt>{DAY_NAME[f]}</dt>
              <dd>
                <button
                  type="button"
                  className="fact__btn"
                  aria-expanded={editing === f}
                  aria-controls="day-edit"
                  aria-label={`${DAY_NAME[f]}: ${v ? agoText(v, refDay) : 'bilinmiyor'}. ${v ? 'Değiştir' : 'Ekle'}`}
                  onClick={() => setEditing((e) => (e === f ? null : f))}
                >
                  {v ? agoText(v, refDay) : ''}
                  <span className="fact__edit">{v ? 'değiştir' : '+ ekle'}</span>
                </button>
              </dd>
            </div>
          );
        })}
        <div>
          <dt>{frozen ? 'Durum' : 'Kalan'}</dt>
          <dd>
            {frozen ? 'Donmuş' : remaining}
            {!frozen && !item.opened && cat?.opened !== undefined && <small className="fact__sub">Paket kapalı</small>}
          </dd>
        </div>
      </dl>

      {editing && (
        <div className="date-edit" id="day-edit">
          <DayChoice
            key={editing}
            label={DAY_QUESTION[editing]}
            value={dayValue(editing)}
            today={refDay}
            // Açılma günü, alınma/pişirilme gününden önce; alınma/pişirilme günü açılma gününden sonra olamaz.
            min={editing === 'openedAt' ? [item.boughtAt, item.cookedAt].filter((d): d is string => !!d).sort().pop() : undefined}
            max={(editing === 'boughtAt' || editing === 'cookedAt') && item.opened ? item.openedAt : undefined}
            onChange={(d) => d !== dayValue(editing) && changeDay(editing, d)}
          />
          <p className="date-edit__result">
            {editing === 'boughtAt' && item.dateSource !== 'auto' ? 'Paketteki ya da elle girilen tarih değişmez. ' : ''}
            Son gün: <strong>{leftLabel(item, refDay)}</strong> · {longDate(item.useBy, refDay)}
          </p>
          <div className="date-edit__row">
            {editing === 'boughtAt' && item.boughtAt && (
              <button type="button" className="link-btn link-btn--muted" onClick={() => changeDay('boughtAt', null)}>
                Kaldır
              </button>
            )}
            <button type="button" className="btn btn--soft" onClick={() => setEditing(null)}>
              Tamam
            </button>
          </div>
        </div>
      )}

      {levelled && item.opened && (
        <div className="level">
          <div className="level__head">
            <span className="field__label">Açık paket</span>
            <span className="level__now">Açık{item.level ? ` · ${LEVEL_LABEL[item.level]}` : ''}</span>
          </div>
          <Segmented<Level>
            label="Açık paketin doluluğu"
            value={item.level as Level}
            options={(['full', 'half', 'low'] as Level[]).map((l) => ({
              id: l,
              label: LEVEL_LABEL[l],
            }))}
            onChange={(level) => {
              endQtyEdit();
              const old = item.level;
              update(item.id, { level });
              toast({ text: `${item.name}: ${LEVEL_LABEL[level]} (yaklaşık)`, tone: 'good', undo: () => update(item.id, { level: old }) });
            }}
          />
          <small className="level__note">Yaklaşık; göz kararı seçmen yeterli.</small>
        </div>
      )}

      <div className="field field--row">
        <span className="field__label">
          Miktar <small>{UNIT_LABEL[w.unit]}</small>
        </span>
        <Stepper value={item.quantity} min={0} max={MAX_QTY} onChange={changeQty} label={`Miktar (${UNIT_LABEL[w.unit]})`} />
      </div>

      {editDate && (
        <div className="date-edit">
          <Segmented<'package' | 'manual'>
            label="Tarih nereden?"
            value={dateMode as 'package' | 'manual'}
            options={[
              { id: 'package', label: 'Paketteki tarih' },
              { id: 'manual', label: 'Kendim gireyim' },
            ]}
            onChange={setDateMode}
          />
          {dateMode === 'package' && (
            <>
              <Segmented<PackageKind>
                label="Paketteki tarihin türü"
                value={kind}
                options={[
                  { id: 'stt', label: 'STT' },
                  { id: 'tett', label: 'TETT' },
                  { id: 'unknown', label: 'Bilmiyorum' },
                ]}
                onChange={(k) => {
                  setKind(k);
                  if (item.dateSource === 'package') applyPackage(item.baseUseBy ?? item.useBy, k);
                }}
              />
              <small className="date-edit__hint">STT: son tüketim tarihi, geçince tüketme. TETT: tavsiye edilen tarih, geçince kalite düşebilir.</small>
              <label className="field__label" htmlFor="pkg-date">
                Paketteki tarih
              </label>
              <input
                id="pkg-date"
                type="date"
                className="input"
                max="9999-12-31"
                value={item.dateSource === 'package' ? (item.baseUseBy ?? item.useBy) : ''}
                onChange={(e) => isDay(e.target.value) && applyPackage(e.target.value, kind)}
              />
            </>
          )}
          {dateMode === 'manual' && (
            <>
              <label className="field__label" htmlFor="useby-input">
                Yeni son gün
              </label>
              <input
                id="useby-input"
                type="date"
                className="input"
                min={refDay}
                max="9999-12-31"
                value={item.dateSource === 'manual' ? item.useBy : ''}
                onChange={(e) => isDay(e.target.value) && diffDays(e.target.value, refDay) >= 0 && applyManual(e.target.value)}
              />
              <div className="mini-chips">
                {[1, 2, 3, 5, 7].map((n) => {
                  const d = addDays(refDay, n);
                  const on = item.dateSource === 'manual' && item.useBy === d;
                  return (
                    <button key={n} type="button" aria-pressed={on} className={`mini-chip ${on ? 'is-active' : ''}`} onClick={() => applyManual(d)}>
                      {n === 1 ? 'Yarın' : `${n} gün sonra`}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <button type="button" className="btn btn--soft btn--block" onClick={() => setEditDate(false)}>
            Tamam
          </button>
        </div>
      )}

      {cat?.tip && !editDate && !editing && !expired && !frozen && !shouldSuggestFreezing(item, refDay) && (
        <p className="tip">
          <Icon name="sparkle" size={16} /> {cat.tip}
        </p>
      )}

      <div className="detail__actions">
        {expired ? (
          <>
            {wasteButtons ?? (
              <button type="button" className="btn btn--danger btn--lg btn--block" onClick={onWaste}>
                <Icon name="bin" size={20} /> Bozuldu, attım
              </button>
            )}
            {!sttPassed && (
              <button type="button" className={`btn ${strict ? 'btn--ghost' : 'btn--soft'} btn--lg btn--block`} onClick={() => done('eaten')}>
                {strict ? `${verb === 'Bitti' ? 'Bitti' : verb} (yalnızca kayıt)` : `Sorun yoktu, ${verbLower}`}
              </button>
            )}
          </>
        ) : many ? (
          <div className="btn-row">
            <button type="button" className="btn btn--soft btn--lg" onClick={() => done('eaten', 1)}>
              {w.one} {w.word}
            </button>
            <button type="button" className="btn btn--primary btn--lg" onClick={() => done('eaten')}>
              <Icon name="check" size={20} stroke={2.5} /> Hepsi bitti
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => done('eaten')}>
            <Icon name="check" size={20} stroke={2.5} /> {verb === 'Yedim' ? 'Yedim, bitti' : verb === 'Kullandım' ? 'Kullandım, bitti' : 'Bitti'}
          </button>
        )}

        <div className="action-grid">
          {canUseSome && (
            <button
              type="button"
              className="action"
              onClick={() =>
                act(
                  useSome,
                  (now) =>
                    `${item.name}: ${!item.opened && many ? `${w.one} açıldı` : 'açık paket'} · ${now.level ? LEVEL_LABEL[now.level] : 'Açık'} (yaklaşık)${now.level === 'low' && item.level === 'low' ? '. Bitince “Bitti”ye dokun' : ''}`,
                  true,
                )
              }
            >
              <Icon name="minus" /> Biraz kullandım
            </button>
          )}
          {canOpen(item, refDay) && (
            <button
              type="button"
              className="action"
              onClick={() =>
                act(
                  (id) => open(id),
                  (now) => `${many ? `${w.one} açıldı` : 'Açıldı'}${now.storage !== item.storage ? ', buzdolabına taşındı' : ''}: ${leftLabel(now, refDay).toLocaleLowerCase('tr')}`,
                  true,
                )
              }
            >
              <Icon name="open" /> {many ? `${w.one} açtım` : 'Açtım'}
            </button>
          )}
          {canThaw(item) && (
            <button type="button" className="action" onClick={() => act(thaw, (now) => `${many ? w.one : item.name} buzdolabında çözülüyor: ${leftLabel(now, refDay).toLocaleLowerCase('tr')}`)}>
              <Icon name="fridge" /> {many ? `${w.one} çözdür` : 'Çözdür'}
            </button>
          )}
          {fridgeUseBy && (
            <button type="button" className="action" onClick={() => act(moveToFridge, (now) => `${item.name} buzdolabına alındı: ${leftLabel(now, refDay).toLocaleLowerCase('tr')}`)}>
              <Icon name="fridge" /> Buzdolabına al
            </button>
          )}
          {canFreeze(item, refDay) && !stable && (
            <button type="button" className="action" onClick={() => act(freeze, () => `${many ? w.one : item.name} dondurucuya taşındı`)}>
              <Icon name="snow" /> {many ? `${w.one} dondur` : 'Dondur'}
            </button>
          )}
          {!expired && !stable && (
            <button type="button" className={`action ${planning ? 'is-active' : ''}`} aria-expanded={planning} onClick={() => setPlanning((v) => !v)}>
              <Icon name="clock" /> Planla
            </button>
          )}
          {/* Tarihi geçmiş üründe de: paketteki gerçek tarihi girmek ya da yanlış yazılanı düzeltmek mümkün olsun. */}
          {(
            <button type="button" className={`action ${editDate ? 'is-active' : ''}`} aria-expanded={editDate} onClick={() => setEditDate((v) => !v)}>
              <Icon name="calendar" /> Tarihi düzelt
            </button>
          )}
          {!expired && !wasteChoice && (
            <button type="button" className="action action--warn" onClick={onWaste}>
              <Icon name="bin" /> Bozuldu, attım
            </button>
          )}
        </div>
        {!expired && wasteButtons}

        {planning && (
          <section className="detail__plan" aria-label="Plan">
            <h3 className="detail__plan-title">Ne zaman, ne yapacaksın?</h3>
            <PlanForm item={item} ideas={planIdeas(item)} today={refDay} onSaved={() => setPlanning(false)} />
          </section>
        )}

        {myPlans.length > 0 && (
          <ul className="detail__plans" aria-label="Planların">
            {myPlans.map((p) => (
              <li key={p.id}>
                <Icon name="clock" size={16} />
                <span>
                  <strong>{planDayLabel(p.day, refDay)}</strong> · {p.title}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${p.title} planını sil`}
                  onClick={() => {
                    useFridge.getState().removePlan(p.id);
                    toast({ text: 'Plan silindi', undo: () => useFridge.setState((s) => ({ plans: [...s.plans, p].sort((a, b) => a.day.localeCompare(b.day)) })) });
                  }}
                >
                  <Icon name="x" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="detail__links">
          <button type="button" className="link-btn" onClick={() => addItemToShopping(item)}>
            <Icon name="plus" size={16} /> Alışveriş listesine ekle
          </button>
          <button
            type="button"
            className="link-btn link-btn--muted"
            onClick={() => {
              remove(item.id);
              toast({
                text: `${item.name} silindi`,
                undo: () => restore(snapshot),
              });
              close();
            }}
          >
            <Icon name="x" size={16} /> Yanlış eklendi, sil
          </button>
        </div>
      </div>
    </div>
  );
}
