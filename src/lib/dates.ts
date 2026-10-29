import type { DayString } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDay(d: Date): DayString {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(s: DayString): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function today(): DayString {
  return toDay(new Date());
}

export function addDays(day: DayString, n: number): DayString {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

/** `to - from` gün farkı (yaz saatinden etkilenmez). */
export function diffDays(to: DayString, from: DayString): number {
  const a = parseDay(to);
  const b = parseDay(from);
  return Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86_400_000);
}

const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export function weekday(day: DayString): string {
  return WEEKDAYS[parseDay(day).getDay()]!;
}

/** "26 Ekim Pazartesi"; başka bir yıldaysa "22 Ağustos 2027". */
export function longDate(day: DayString, ref: DayString = today()): string {
  const d = parseDay(day);
  if (d.getFullYear() !== parseDay(ref).getFullYear()) return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${WEEKDAYS[d.getDay()]}`;
}

/** Uzun süreler için kaba ifade: "3 ay", "1 yıl", "2 yıl". */
export function roughDuration(days: number): string {
  if (days >= 365) return `${Math.round(days / 365)} yıl`;
  return `${Math.round(days / 30)} ay`;
}

export function shortDate(day: DayString): string {
  const d = parseDay(day);
  return `${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)}`;
}

/** "Bugün", "Yarın", "Cuma" ya da "3 Kas" gibi göreli gün adı. */
export function relativeDay(day: DayString, ref: DayString = today()): string {
  const n = diffDays(day, ref);
  if (n === 0) return 'Bugün';
  if (n === 1) return 'Yarın';
  if (n === -1) return 'Dün';
  if (n > 1 && n < 7) return weekday(day);
  return shortDate(day);
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}
