import { beforeEach, describe, expect, it } from 'vitest';
import { useFridge } from '../store/useFridge';
import { addDays, today } from './dates';
import { nextDays, planDayLabel, planIdeas, planWarning, visiblePlans } from './plans';
import { buildCalendar, calendarChanges, calendarSignature } from './calendar';
import { cleanList, cleanPlan } from './validate';
import { notifyIfNeeded } from './notify';
import type { FridgeItem } from '../types';

const T = today();
const s = () => useFridge.getState();
const spinach = (useBy: string): FridgeItem => ({ id: 'isp', catalogId: 'ispanak', name: 'Ispanak', img: '🥬', category: 'sebze', storage: 'fridge', quantity: 1, addedAt: T, useBy, baseUseBy: useBy, opened: false, dateSource: 'auto' });

beforeEach(() => useFridge.setState({ items: [], history: [], shopping: [], plans: [] }));

describe('planlar', () => {
  it('plan eklenir, güne göre sıralanır, silinir', () => {
    const a = s().addPlan({ day: addDays(T, 3), title: 'Ispanak yemeği', name: 'Ispanak', img: '🥬', category: 'sebze', itemId: 'isp' });
    s().addPlan({ day: addDays(T, 1), title: 'Kavurma', name: 'Kırmızı Et', img: '🥩', category: 'et' });
    expect(s().plans.map((p) => p.title)).toEqual(['Kavurma', 'Ispanak yemeği']);
    s().removePlan(a.id);
    expect(s().plans).toHaveLength(1);
  });
  it('plan günü ürünün son gününden sonraysa uyarır', () => {
    const item = spinach(addDays(T, 2));
    expect(planWarning(addDays(T, 2), item, T)).toBeUndefined();
    expect(planWarning(addDays(T, 4), item, T)).toMatch(/dayanmayabilir/);
  });
  it('gün adları ve öneriler', () => {
    expect(planDayLabel(T, T)).toBe('Bugün');
    expect(planDayLabel(addDays(T, 1), T)).toBe('Yarın');
    expect(planDayLabel(addDays(T, -1), T)).toBe('Dün');
    expect(nextDays(T)).toHaveLength(7);
    const ideas = planIdeas(spinach(addDays(T, 3)));
    expect(ideas.some((x) => /Ispanak/i.test(x))).toBe(true);
  });
  it('ana ekranda 7 gün içindeki ve kaçırılan planlar', () => {
    s().addPlan({ day: addDays(T, -1), title: 'Dünkü', name: 'X', img: '🥬', category: 'sebze' });
    s().addPlan({ day: addDays(T, 10), title: 'Uzak', name: 'X', img: '🥬', category: 'sebze' });
    expect(visiblePlans(s().plans, T).map((p) => p.title)).toEqual(['Dünkü']);
  });
  it('yedekten bozulmadan döner', () => {
    const p = s().addPlan({ day: addDays(T, 2), title: 'Ispanak yemeği', name: 'Ispanak', img: '🥬', category: 'sebze', itemId: 'isp', recipeId: 'zeytinyagli-ispanak' });
    expect(cleanList(JSON.parse(JSON.stringify([p])), cleanPlan).ok[0]).toEqual(p);
  });
});

describe('planlar takvimde', () => {
  it('plan günü sabah etkinlik olur; silinince iptal, değişince güncel değil', () => {
    const p = s().addPlan({ day: addDays(T, 3), title: 'Ispanak yemeği', name: 'Ispanak', img: '🥬', category: 'sebze' });
    const ics = buildCalendar([], 2, new Date(), [], [], s().plans);
    expect(ics).toContain(`UID:plan-${p.id}@dolapta-ne-var`);
    expect(ics).toContain('SUMMARY:Plan: Ispanak yemeği');
    const saved = { sig: calendarSignature([], T, s().plans), lead: 2 };
    expect(calendarChanges([], saved, 2, T, s().plans).total).toBe(0);
    s().updatePlan(p.id, { day: addDays(T, 4) });
    expect(calendarChanges([], saved, 2, T, s().plans).changed).toBe(1);
    s().removePlan(p.id);
    expect(calendarChanges([], saved, 2, T, s().plans).removed).toBe(1);
    const next = buildCalendar([], 2, new Date(), [], Object.keys(saved.sig), s().plans);
    expect(next).toContain(`UID:plan-${p.id}@dolapta-ne-var`);
    expect(next).toContain('STATUS:CANCELLED');
  });
  it('bugünkü plan günlük bildirime girer', async () => {
    const shown: string[] = [];
    // @ts-expect-error test için Notification taklidi
    globalThis.Notification = class {
      static permission = 'granted';
      constructor(title: string, o: { body: string }) {
        shown.push(`${title} | ${o.body}`);
      }
    };
    const d = await notifyIfNeeded([], { leadDays: 2, notifications: true }, [{ id: 'p', day: T, title: 'Kavurma', name: 'Et', img: '🥩', category: 'et', createdAt: T }]);
    expect(d).toBe(T);
    expect(shown[0]).toMatch(/Kavurma/);
  });
});
