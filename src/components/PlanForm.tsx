import { useState } from 'react';
import { useFridge } from '../store/useFridge';
import { diffDays } from '../lib/dates';
import { nextDays, planDayLabel, planWarning } from '../lib/plans';
import { Icon } from './Icon';
import { toast } from './Toast';
import type { CategoryId, DayString, FridgeItem, Plan } from '../types';

/**
 * "Ne yapacaksın, hangi gün?": ileriye dönük plan. O gün ana ekranda hatırlatılır (takvim dosyasına da girer).
 * Ürün o güne kadar dayanmayacaksa uyarır.
 */
export function PlanForm({
  item,
  subject,
  ideas,
  defaultTitle = '',
  recipeId,
  today,
  onSaved,
}: {
  item?: FridgeItem;
  /** Ürün yoksa (tarif planı) gösterilecek ad ve görsel. */
  subject?: { name: string; img: string; category: CategoryId };
  ideas: string[];
  defaultTitle?: string;
  recipeId?: string;
  today: DayString;
  onSaved?: (plan: Plan) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [day, setDay] = useState<DayString | null>(null);
  const warning = day ? planWarning(day, item, today) : undefined;
  const who = item ?? subject;

  const save = () => {
    if (!day || !title.trim() || !who) return;
    const { addPlan, removePlan } = useFridge.getState();
    const plan = addPlan({ day, title, name: who.name, img: who.img, category: who.category, ...(item ? { itemId: item.id, catalogId: item.catalogId } : {}), ...(recipeId ? { recipeId } : {}) });
    toast({ text: `Plan: ${planDayLabel(day, today)} · ${plan.title}. O gün hatırlatırız.`, tone: 'good', undo: () => removePlan(plan.id) });
    onSaved?.(plan);
  };

  return (
    <div className="plan-form">
      <PlanFields title={title} setTitle={setTitle} day={day} setDay={setDay} ideas={ideas} today={today} warning={warning} />
      <button type="button" className="btn btn--primary btn--lg btn--block" disabled={!day || !title.trim()} onClick={save}>
        <Icon name="calendar" size={20} /> {day ? `${planDayLabel(day, today)} için planla` : 'Gün seç'}
      </button>
    </div>
  );
}

/** Ne yapılacak + hangi gün alanları (plan formu ve ekleme formu ortak kullanır). */
export function PlanFields({
  title,
  setTitle,
  day,
  setDay,
  ideas,
  today,
  warning,
}: {
  title: string;
  setTitle: (v: string) => void;
  day: DayString | null;
  setDay: (d: DayString | null) => void;
  ideas: string[];
  today: DayString;
  warning?: string;
}) {
  const [picking, setPicking] = useState(false);
  const days = nextDays(today);
  return (
    <>
      <label className="field">
        <span className="field__label">Ne yapacaksın?</span>
        <input id="plan-title" className="input" value={title} maxLength={60} placeholder="Örn. Ispanak yemeği, kavurma" onChange={(e) => setTitle(e.target.value)} enterKeyHint="done" />
      </label>
      {ideas.length > 0 && (
        <div className="plan-form__ideas" role="group" aria-label="Öneriler">
          {ideas.map((x) => (
            <button key={x} type="button" className={`chip ${title === x ? 'is-active' : ''}`} aria-pressed={title === x} onClick={() => setTitle(x)}>
              {x}
            </button>
          ))}
        </div>
      )}

      <div className="field">
        <span className="field__label">Hangi gün?</span>
        <div className="plan-form__days" role="group" aria-label="Plan günü">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              className={`chip ${day === d && !picking ? 'is-active' : ''}`}
              aria-pressed={day === d && !picking}
              onClick={() => {
                setPicking(false);
                setDay(d);
              }}
            >
              {planDayLabel(d, today)}
            </button>
          ))}
          <button type="button" className={`chip ${picking ? 'is-active' : ''}`} aria-pressed={picking} onClick={() => setPicking(true)}>
            Tarih seç
          </button>
        </div>
        {picking && (
          <input
            className="input plan-form__date"
            type="date"
            aria-label="Plan günü"
            min={today}
            value={day ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (/^\d{4}-\d{2}-\d{2}$/.test(v) && diffDays(v, today) >= 0) setDay(v);
            }}
          />
        )}
      </div>

      {warning && (
        <p className="note note--warn" role="status">
          <Icon name="info" size={18} />
          <span>{warning}</span>
        </p>
      )}
    </>
  );
}
