import { useMemo } from 'react';
import { useFridge } from '../store/useFridge';
import { getCategory } from '../data/catalog';
import { diffDays, relativeDay } from '../lib/dates';
import { useToday } from '../lib/useToday';
import { FoodTile } from '../components/Food';
import { Icon } from '../components/Icon';
import { urgency } from '../lib/freshness';
import { defaultUnit, UNIT_LABEL, UNITS } from '../lib/units';
import { toast } from '../components/Toast';
import type { CategoryId, HistoryEntry, Unit } from '../types';

/**
 * Oran kayıt sayısından hesaplanır: her "bitti/yedim" ya da "attım" işareti bir kayıttır.
 * Adet, paket ve kap farklı ölçüler olduğu için toplanıp tek yüzdeye çevrilmez; miktarlar birimine göre ayrı gösterilir.
 * Tariften artan yemeğin yenmesi (derived) sayılmaz: malzemeleri pişirirken zaten sayıldı.
 */
const counted = (list: HistoryEntry[]) => list.filter((h) => !h.derived);
const unitOfEntry = (h: HistoryEntry): Unit => h.unit ?? h.item?.unit ?? defaultUnit({ catalogId: h.item?.catalogId, category: h.category });
/** "12 adet · 3 paket · 2 kap" */
function byUnit(list: HistoryEntry[]): string {
  const m = new Map<Unit, number>();
  list.forEach((h) => m.set(unitOfEntry(h), (m.get(unitOfEntry(h)) ?? 0) + h.quantity));
  return UNITS.filter((u) => m.has(u))
    .map((u) => `${m.get(u)} ${UNIT_LABEL[u]}`)
    .join(' · ');
}
/** Bu kadar kayıttan azıyla yüzde gösterilmez (1 kayıt %100 demek yanıltıcı). */
const MIN_RECORDS = 5;
/** Tek bir yemeğin malzemeleri de birden çok kayıttır: yüzde için kayıtlar en az iki ayrı güne yayılmalı. */
const MIN_DAYS = 2;

export function Stats() {
  const history = useFridge((s) => s.history);
  const items = useFridge((s) => s.items);
  const leadDays = useFridge((s) => s.settings.leadDays);
  const ref = useToday();
  // Tarihi geçip henüz karar verilmemiş ürünler: "harika" demeden önce bunlar sayılır.
  const pending = items.filter((i) => urgency(i, leadDays, ref) === 'expired').length;
  const month = useMemo(() => history.filter((h) => diffDays(ref, h.date) < 30), [history, ref]);
  const eatenList = counted(month.filter((h) => h.outcome === 'eaten'));
  const wastedList = counted(month.filter((h) => h.outcome === 'wasted'));
  const eaten = eatenList.length;
  const wasted = wastedList.length;
  const total = eaten + wasted;
  const enough = total >= MIN_RECORDS && new Set([...eatenList, ...wastedList].map((h) => h.date)).size >= MIN_DAYS;
  const rate = total ? Math.round((eaten / total) * 100) : 0;
  const leftoversEaten = month.filter((h) => h.derived).length;

  const weeks = useMemo(() => {
    return [3, 2, 1, 0].map((w) => {
      const inWeek = history.filter((h) => {
        const d = diffDays(ref, h.date);
        return d >= w * 7 && d < (w + 1) * 7;
      });
      return {
        label: w === 0 ? 'Bu hafta' : w === 1 ? 'Geçen hafta' : `${w} hafta önce`,
        eaten: counted(inWeek.filter((h) => h.outcome === 'eaten')).length,
        wasted: counted(inWeek.filter((h) => h.outcome === 'wasted')).length,
      };
    });
  }, [history, ref]);
  const maxWeek = Math.max(1, ...weeks.map((w) => w.eaten + w.wasted));

  const topWasted = useMemo(() => {
    const m = new Map<CategoryId, number>();
    month.filter((h) => h.outcome === 'wasted').forEach((h) => m.set(h.category, (m.get(h.category) ?? 0) + 1));
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    // Tek bir kayıttan genelleme yapma.
    return top && top[1] >= 2 ? top : undefined;
  }, [month]);

  const r = 52;
  const c = 2 * Math.PI * r;

  return (
    <main className="screen">
      <header className="page-head">
        <p className="eyebrow">Son 30 gün</p>
        <h1 className="display">Özet</h1>
      </header>

      {total === 0 ? (
        <div className="empty-card">
          <span className="empty-card__art">
            <FoodTile img="🥗" category="sebze" size={72} />
          </span>
          <h2>Henüz kayıt yok</h2>
          <p>Bir ürüne ✓ ile “Yedim/Bitti” ya da “Bozuldu, attım” dediğinde kayıtların burada görünür. Yüzde, en az {MIN_RECORDS} kayıt ve iki farklı gün olunca hesaplanır.</p>
        </div>
      ) : (
        <>
          <section className="score-card">
            {enough ? (
              <svg width="128" height="128" viewBox="0 0 128 128" role="img" aria-label={`Kayıtların yüzde ${rate}'i tüketildi olarak işaretlendi`}>
                <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="12" />
                <circle
                  cx="64"
                  cy="64"
                  r={r}
                  fill="none"
                  stroke="var(--brand)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(c * rate) / 100} ${c}`}
                  transform="rotate(-90 64 64)"
                  className="score-card__arc"
                />
                <text x="64" y="62" textAnchor="middle" className="score-card__pct">
                  %{rate}
                </text>
                <text x="64" y="82" textAnchor="middle" className="score-card__lbl">
                  tüketildi
                </text>
              </svg>
            ) : (
              <span className="score-card__few" aria-hidden="true">
                {total}
                <small>kayıt</small>
              </span>
            )}
            <div className="score-card__text">
              <h2>{!enough ? 'Yüzde için kayıt az' : pending ? 'Bekleyenler var' : rate >= 85 ? 'Harika gidiyorsun!' : rate >= 60 ? 'İyi yoldasın' : 'Birlikte azaltalım'}</h2>
              <p>
                <strong>{eaten}</strong> kayıt tüketildi{wasted > 0 && <>, <strong>{wasted}</strong> kayıt atıldı</>}.
              </p>
              {eatenList.length > 0 && <p className="score-card__units">Tüketilen: {byUnit(eatenList)}</p>}
              {wastedList.length > 0 && <p className="score-card__units">Atılan: {byUnit(wastedList)}</p>}
            </div>
          </section>
          <p className="stats-how">
            {enough ? 'Yüzde' : `Yüzde, en az ${MIN_RECORDS} kayıt ve iki farklı gün olunca gösterilir. Hesap`}, son 30 günde “Bitti / Yedim / Kullandım” ve “Attım” olarak işaretlediğin kayıtlardan yapılır; her işaret bir kayıt sayılır. Adet, paket ve kap toplanmaz, yukarıda ayrı gösterilir. Tüketilen her ürün israftan kurtarılmış sayılmaz; yalnızca ne kadarının tüketildiğini gösterir.
            {leftoversEaten > 0 && ` Tariften artan ${leftoversEaten} yemek kaydı, malzemeleri pişirirken sayıldığı için tekrar sayılmadı.`}
          </p>

          <section className="card">
            <h2 className="card__title">Haftalık (kayıt sayısı)</h2>
            <div className="bars" role="img" aria-label={`Son 4 hafta, kayıt sayısı: ${weeks.map((w) => `${w.label} ${w.eaten} tüketildi, ${w.wasted} atıldı`).join('; ')}`}>
              {weeks.map((w) => (
                <div key={w.label} className="bars__col">
                  <div className="bars__stack">
                    <span className="bars__wasted" style={{ height: `${(w.wasted / maxWeek) * 100}%` }} />
                    <span className="bars__eaten" style={{ height: `${(w.eaten / maxWeek) * 100}%` }} />
                  </div>
                  <span className="bars__lbl">{w.label}</span>
                </div>
              ))}
            </div>
            <div className="legend">
              <span>
                <i className="legend__dot legend__dot--eaten" /> Tüketildi
              </span>
              <span>
                <i className="legend__dot legend__dot--wasted" /> Atıldı
              </span>
            </div>
          </section>

          {pending > 0 && (
            <p className="note note--warn">
              <Icon name="info" size={18} />
              <span>
                Mutfağında tarihi geçmiş <strong>{pending}</strong> ürün karar bekliyor. Yediysen ya da attıysan işaretle; oran ona göre güncellenir.
              </span>
            </p>
          )}

          {topWasted && (
            <p className="note">
              <Icon name="info" size={18} />
              <span>
                En çok <strong>{getCategory(topWasted[0]).name}</strong> kategorisinden ürün atılıyor. Bir sonraki alışverişte biraz daha az almayı ya da erken dondurmayı dene.
              </span>
            </p>
          )}
        </>
      )}

      {history.length > 0 && (
        <section className="card">
          <h2 className="card__title">Son hareketler</h2>
          <ul className="history">
            {history.slice(0, 15).map((h) => (
              <li key={h.id}>
                <FoodTile img={h.img} category={h.category} size={40} />
                <span className="history__name">
                  <span>
                    {h.name}{' '}
                    <small>
                      ({h.quantity} {UNIT_LABEL[unitOfEntry(h)]})
                    </small>
                  </span>
                  <span className="history__meta">
                    <span className={`history__tag ${h.outcome === 'eaten' ? 'is-eaten' : 'is-wasted'}`}>{h.outcome === 'eaten' ? (h.derived ? 'Artan yemek yendi' : 'Tüketildi') : 'Atıldı'}</span> {relativeDay(h.date)}
                  </span>
                </span>
                {/* Yanlışlıkla işaretlendiyse ürünü mutfağa geri getir (son 7 gün). */}
                {h.item && diffDays(ref, h.date) <= 7 && (
                  <button
                    type="button"
                    className="history__undo"
                    aria-label={`${h.name}: geri getir`}
                    onClick={() => {
                      const prev = { items: useFridge.getState().items, history: useFridge.getState().history };
                      if (useFridge.getState().revert(h.id)) toast({ text: `${h.name} mutfağa geri getirildi`, tone: 'good', undo: () => useFridge.setState(prev) });
                    }}
                  >
                    <Icon name="undo" size={16} /> Geri getir
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="list-end" />
    </main>
  );
}
