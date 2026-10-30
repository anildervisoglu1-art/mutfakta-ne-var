import { useFridge } from '../store/useFridge';
import { diffDays } from '../lib/dates';
import { planDayLabel, visiblePlans } from '../lib/plans';
import { qtyText, unitOf } from '../lib/units';
import { undoFinish } from '../screens/Home';
import { FoodTile } from './Food';
import { Icon } from './Icon';
import { toast } from './Toast';
import type { Plan } from '../types';

/** Ana ekranda planlar: bugünkü ve kaçırılanlar öne çıkar, önümüzdeki 7 gün altında. */
export function PlansCard({ today, onOpenItem }: { today: string; onOpenItem: (id: string) => void }) {
  const plans = useFridge((s) => s.plans);
  const items = useFridge((s) => s.items);
  const list = visiblePlans(plans, today);
  if (list.length === 0) return null;
  const dueCount = list.filter((p) => diffDays(p.day, today) <= 0).length;

  const putBack = (p: Plan) => useFridge.setState((s) => (s.plans.some((x) => x.id === p.id) ? s : { plans: [...s.plans, p].sort((a, b) => a.day.localeCompare(b.day)) }));

  const done = (p: Plan) => {
    useFridge.getState().removePlan(p.id);
    const item = p.itemId ? useFridge.getState().items.find((i) => i.id === p.itemId) : undefined;
    toast({
      text: `${p.title}: yapıldı, afiyet olsun!`,
      tone: 'good',
      undo: () => putBack(p),
      // Plandaki ürün kullanıldıysa tek dokunuşla düşülür (yapıldı + düşüldü birlikte geri alınabilir).
      action: item
        ? {
            label: `${qtyText(1, unitOf(item))} düş`,
            run: () => {
              const snap = { ...item };
              const hid = useFridge.getState().finish(item.id, 'eaten', 1);
              setTimeout(
                () =>
                  toast({
                    text: `${item.name}: ${qtyText(1, unitOf(item))} düşüldü`,
                    tone: 'good',
                    undo: () => {
                      undoFinish(snap, hid);
                      putBack(p);
                    },
                  }),
                0,
              );
            },
          }
        : undefined,
    });
  };

  const drop = (p: Plan) => {
    useFridge.getState().removePlan(p.id);
    toast({ text: 'Plan silindi', undo: () => putBack(p) });
  };

  return (
    <section className={`plans ${dueCount ? 'plans--due' : ''}`} aria-labelledby="plans-title">
      <h2 id="plans-title" className="plans__title">
        <Icon name="clock" size={18} /> Planların
      </h2>
      <ul className="plans__list">
        {list.map((p) => {
          const n = diffDays(p.day, today);
          const linked = p.itemId && items.some((i) => i.id === p.itemId) ? p.itemId : undefined;
          return (
            <li key={p.id} className={`plan ${n < 0 ? 'is-late' : n === 0 ? 'is-today' : ''}`}>
              <button type="button" className="plan__main" onClick={() => linked && onOpenItem(linked)} disabled={!linked} aria-label={`${planDayLabel(p.day, today)}: ${p.title} (${p.name})`}>
                <FoodTile img={p.img} category={p.category} size={40} />
                <span className="plan__text">
                  <span className="plan__day">{n < 0 ? `${planDayLabel(p.day, today)} yapacaktın` : n === 0 ? 'Bugün yapacaksın' : planDayLabel(p.day, today)}</span>
                  <strong>{p.title}</strong>
                  {p.title.toLocaleLowerCase('tr').includes(p.name.toLocaleLowerCase('tr')) ? null : <small>{p.name}</small>}
                </span>
              </button>
              {n <= 0 && (
                <button type="button" className="plan__done" onClick={() => done(p)} aria-label={`${p.title}: yaptım`}>
                  <Icon name="check" size={18} stroke={2.6} />
                  <span>Yaptım</span>
                </button>
              )}
              <button type="button" className="icon-btn plan__drop" onClick={() => drop(p)} aria-label={`${p.title} planını sil`}>
                <Icon name="x" size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
