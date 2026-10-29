import { useState } from 'react';
import { Icon } from './Icon';

export function Stepper({ value, onChange, min = 1, max = 99, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  // Yazarken her tuş kaydedilmez (12 → 1 → 13 olmasın, yanlışlıkla 0 ürünü bitirmesin): yazı yerelde tutulur, Enter'da ya da odak çıkınca kaydedilir.
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const n = Math.floor(Number(text));
    setText(null);
    if (text.trim() !== '' && Number.isFinite(n) && n !== value) onChange(Math.max(min, Math.min(max, n)));
  };
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper__btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Azalt">
        <Icon name="minus" size={18} stroke={2.5} />
      </button>
      {/* Sayıya dokunup doğrudan yazılabilir (30 yumurta için 29 kez + yok). */}
      <input
        className="stepper__value"
        type="number"
        inputMode="numeric"
        enterKeyHint="done"
        min={min}
        max={max}
        value={text ?? value}
        aria-label={label}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Enter yalnızca odaktan çıkarır; kayıt onBlur'da bir kez yapılır (iki kez "bitti" kaydı oluşmasın).
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setText(null);
        }}
      />
      <button type="button" className="stepper__btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Artır">
        <Icon name="plus" size={18} stroke={2.5} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      className="segmented"
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => {
        // Radyo grubu deseni: oklarla seçenek değiştir.
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const enabled = options.filter((o) => !o.disabled);
        const i = enabled.findIndex((o) => o.id === value);
        const next = enabled[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + enabled.length) % enabled.length];
        if (!next) return;
        const group = e.currentTarget;
        onChange(next.id);
        requestAnimationFrame(() => (group.querySelector(`[data-id="${next.id}"]`) as HTMLElement | null)?.focus());
      }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          data-id={o.id}
          aria-checked={value === o.id}
          // Seçim yoksa grubun ilk seçeneği klavyeyle ulaşılabilir kalır.
          tabIndex={value === o.id || (!options.some((x) => x.id === value) && o === options[0]) ? 0 : -1}
          disabled={o.disabled}
          className={`segmented__opt ${value === o.id ? 'is-active' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="toggle__knob" />
    </button>
  );
}
