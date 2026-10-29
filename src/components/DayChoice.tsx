import { useState } from 'react';
import { addDays, diffDays, longDate } from '../lib/dates';
import { Segmented } from './Stepper';
import type { DayString } from '../types';

type Choice = 'today' | 'yesterday' | 'pick';

/**
 * "Bugün / Dün / Tarih seç": alınma, açılma ve pişirilme günü için ortak küçük seçici.
 * `value` boşsa hiçbiri seçili değildir (isteğe bağlı alan). Gelecek gün seçilemez.
 */
export function DayChoice({ label, value, onChange, today, min, max }: { label: string; value?: DayString; onChange: (day: DayString) => void; today: DayString; min?: DayString; max?: DayString }) {
  const limit = max && diffDays(max, today) < 0 ? max : today;
  const yesterday = addDays(today, -1);
  const derived: Choice | '' = !value ? '' : value === today ? 'today' : value === yesterday ? 'yesterday' : 'pick';
  const [picking, setPicking] = useState(derived === 'pick');
  const choice: Choice | '' = picking ? 'pick' : derived;
  return (
    <div className="day-choice">
      <Segmented<Choice>
        label={label}
        value={choice as Choice}
        options={[
          { id: 'today', label: 'Bugün', disabled: limit !== today || (!!min && diffDays(today, min) < 0) },
          { id: 'yesterday', label: 'Dün', disabled: diffDays(limit, yesterday) < 0 || (!!min && diffDays(yesterday, min) < 0) },
          { id: 'pick', label: 'Tarih seç' },
        ]}
        onChange={(c) => {
          setPicking(c === 'pick');
          if (c === 'today') onChange(today);
          if (c === 'yesterday') onChange(yesterday);
          // "Tarih seç": henüz gün seçilmediyse ya da bugünse iki gün öncesiyle başlar.
          if (c === 'pick' && (!value || value === today)) {
            // İki gün önce; ama izin verilen aralığın (en erken / en geç) içinde.
            let start = diffDays(limit, addDays(today, -2)) < 0 ? limit : addDays(today, -2);
            if (min && diffDays(start, min) < 0) start = min;
            onChange(start);
          }
        }}
      />
      {choice === 'pick' && (
        <input
          className="input day-choice__date"
          type="date"
          aria-label={label}
          max={limit}
          min={min}
          value={value ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            if (/^\d{4}-\d{2}-\d{2}$/.test(v) && diffDays(limit, v) >= 0 && (!min || diffDays(v, min) >= 0)) onChange(v);
          }}
        />
      )}
      {value && choice === 'pick' && <small className="day-choice__hint">{longDate(value, today)} · {diffDays(today, value)} gün önce</small>}
    </div>
  );
}
