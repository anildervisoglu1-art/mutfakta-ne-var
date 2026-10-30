import type { FridgeItem, HistoryEntry, Plan } from '../types';
import { addDays, diffDays, toDay } from './dates';
import { daysLeft, isStable, leadFor, qualityOnly } from './freshness';
import { UNIT_LABEL, unitOf } from './units';
import type { StorageId } from '../types';

const WHERE: Record<StorageId, string> = { fridge: 'Buzdolabında', freezer: 'Dondurucuda', counter: 'Tezgâhta', pantry: 'Kilerde' };

/** RFC 5545 metin kaçışı: önce ters eğik çizgi. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[;,]/g, (m) => `\\${m}`).replace(/\r?\n|\r/g, '\\n');
const compact = (day: string) => day.replace(/-/g, '');
const pad = (n: number) => String(n).padStart(2, '0');

/** Satırları 75 baytta katlar (çok baytlı karakterleri bölmeden). */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/**
 * Her ürün için uyarı gününün sabahı 09:00'da hatırlatan takvim dosyası (.ics).
 * Uyarı günü bugünse ve saat 09:00'u geçtiyse hatırlatma birkaç dakika sonraya kurulur.
 */
export function buildCalendar(items: FridgeItem[], leadDays: number, now = new Date(), history: HistoryEntry[] = [], previousIds: string[] = [], plans: Plan[] = []): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ref = toDay(now);
  // Takvim uygulaması aynı UID'li etkinliği daha yüksek SEQUENCE ile güncelleyip iptal edebilsin.
  const seq = Math.floor(now.getTime() / 1000);
  const events: string[] = items
    .filter((i) => daysLeft(i, ref) >= 0 && !isStable(i))
    .map((i) => {
      let day = addDays(i.useBy, -Math.min(leadFor(i, leadDays), daysLeft(i, ref)));
      if (day < ref) day = ref;
      let time = '090000';
      if (day === ref && now.getHours() >= 9) {
        const soon = new Date(now.getTime() + 5 * 60_000);
        if (soon.getDate() !== now.getDate()) {
          // Gece yarısına birkaç dakika kala: ertesi sabah 09:00 (hâlâ süresi içindeyse).
          day = addDays(ref, 1);
          if (daysLeft(i, day) < 0) return null;
        } else time = `${pad(soon.getHours())}${pad(soon.getMinutes())}00`;
      }
      const left = daysLeft(i, day);
      // Tahmini ya da türü bilinmeyen tarih kesinmiş gibi yazılmaz; kalite tarihinde "kontrol et" denir.
      const estimated = i.dateSource === 'auto' || (i.dateSource === 'package' && (i.packageKind ?? 'unknown') === 'unknown');
      const quality = qualityOnly(i);
      const base = left === 0 ? 'bugün son gün' : left === 1 ? 'yarın son gün' : `${left} gün kaldı`;
      const when = `${base}${estimated ? ' (tahmini)' : ''}`;
      // Bitiş, başlangıçtan 15 dk sonra (saat ya da gün değişebilir; bitiş başlangıçla aynı olamaz).
      const [y, mo, d] = day.split('-').map(Number) as [number, number, number];
      const endAt = new Date(y, mo - 1, d, Number(time.slice(0, 2)), Number(time.slice(2, 4)) + 15);
      const endStamp = `${compact(toDay(endAt))}T${pad(endAt.getHours())}${pad(endAt.getMinutes())}00`;
      return [
        'BEGIN:VEVENT',
        `UID:${i.id}@dolapta-ne-var`,
        `SEQUENCE:${seq}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${compact(day)}T${time}`,
        `DTEND:${endStamp}`,
        `SUMMARY:${esc(`${i.name}: ${when}`)}`,
        `DESCRIPTION:${esc(`${WHERE[i.storage]} ${i.quantity} ${UNIT_LABEL[unitOf(i)]} ${i.name} var. ${quality ? 'Kalite süresi doluyor; kontrol edip değerlendir.' : `Son günü${estimated ? ' (tahmini)' : ''} yaklaşıyor; kontrol edip değerlendir.`}`)}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${esc(`${i.name}: ${when}`)}`,
        'TRIGGER:PT0M',
        'END:VALARM',
        'END:VEVENT',
      ];
    })
    .filter((e): e is string[] => e !== null)
    .flat();
  // Planlar: plan günü sabah 09:00 ("Bugün: ıspanak yemeği").
  for (const p of plans) {
    if (p.day < ref) continue;
    let time = '090000';
    if (p.day === ref && now.getHours() >= 9) {
      const soon = new Date(now.getTime() + 5 * 60_000);
      if (soon.getDate() !== now.getDate()) continue;
      time = `${pad(soon.getHours())}${pad(soon.getMinutes())}00`;
    }
    const [y, mo, d] = p.day.split('-').map(Number) as [number, number, number];
    const endAt = new Date(y, mo - 1, d, Number(time.slice(0, 2)), Number(time.slice(2, 4)) + 15);
    events.push(
      'BEGIN:VEVENT',
      `UID:${planUid(p.id)}@dolapta-ne-var`,
      `SEQUENCE:${seq}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${compact(p.day)}T${time}`,
      `DTEND:${compact(toDay(endAt))}T${pad(endAt.getHours())}${pad(endAt.getMinutes())}00`,
      `SUMMARY:${esc(`Plan: ${p.title}`)}`,
      `DESCRIPTION:${esc(`${p.name} için planın: ${p.title}. Mutfakta Ne Var?`)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`Bugün: ${p.title}`)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  const live = new Set(items.map((i) => i.id));
  const withEvent = new Set(events.filter((l) => l.startsWith('UID:')).map((l) => l.slice(4).replace('@dolapta-ne-var', '')));
  // İptal edilenler: son 30 günde biten/atılanlar ve önceki dosyada olup bu dosyada etkinliği olmayanlar (silinen, tarihi geçmişe çekilen).
  const cancelled = [...history.filter((h) => h.item && diffDays(ref, h.date) <= 30 && !live.has(h.item.id)).map((h) => h.item!.id), ...previousIds.map(uidKey).filter((id) => !withEvent.has(id))]
    .filter((id, idx, arr) => arr.indexOf(id) === idx)
    .flatMap((id) => ['BEGIN:VEVENT', `UID:${id}@dolapta-ne-var`, `SEQUENCE:${seq}`, `DTSTAMP:${stamp}`, `DTSTART:${compact(ref)}T090000`, 'STATUS:CANCELLED', 'SUMMARY:Mutfakta Ne Var? (iptal)', 'END:VEVENT']);
  events.push(...cancelled);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mutfakta Ne Var//TR', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Planın takvim kimliği; imzada "plan:<id>" anahtarıyla tutulur. */
const planUid = (id: string) => `plan-${id}`;
const uidKey = (key: string) => (key.startsWith('plan:') ? planUid(key.slice(5)) : key);

/** Takvim dosyasına giren ürünler (bozulmayanlar ve tarihi geçenler hatırlatılmaz). */
const inCalendar = (items: FridgeItem[], ref: string) => items.filter((i) => daysLeft(i, ref) >= 0 && !isStable(i));
/** Hatırlatıcıyı etkileyen her şey: son gün, miktar, yer, açıklık. */
const sigOf = (i: FridgeItem) => `${i.useBy}|${i.quantity}|${i.storage}|${i.opened ? 1 : 0}|${i.name}`;

export function calendarSignature(items: FridgeItem[], ref: string, plans: Plan[] = []): Record<string, string> {
  return {
    ...Object.fromEntries(inCalendar(items, ref).map((i) => [i.id, sigOf(i)])),
    ...Object.fromEntries(plans.filter((p) => p.day >= ref).map((p) => [`plan:${p.id}`, `${p.day}|${p.title}`])),
  };
}

/**
 * Son takvim dosyasından bu yana hatırlatıcıları etkileyen değişiklikler:
 * yeni eklenen, biten/atılan, tarihi/miktarı/yeri değişen (açılan, dondurulan) ürünler ve uyarı süresinin değişmesi.
 */
export function calendarChanges(
  items: FridgeItem[],
  saved: { sig: Record<string, string>; lead: number },
  leadDays: number,
  ref: string,
  plans: Plan[] = [],
): { added: number; removed: number; changed: number; total: number; leadChanged: boolean } {
  const now = calendarSignature(items, ref, plans);
  let added = 0;
  let changed = 0;
  let leadChanged = false;
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const [id, sig] of Object.entries(now)) {
    if (!(id in saved.sig)) added++;
    else if (saved.sig[id] !== sig) changed++;
    else if (!id.startsWith('plan:') && saved.lead !== leadDays && leadFor(byId.get(id)!, saved.lead) !== leadFor(byId.get(id)!, leadDays)) {
      // Uyarı süresi değişti; yalnızca hatırlatma günü gerçekten kayan ürünler sayılır.
      changed++;
      leadChanged = true;
    }
  }
  // Bitenler/atılanlar iptal edilmeli.
  const livePlans = new Set(plans.map((p) => `plan:${p.id}`));
  // Planın günü geçtiyse takvimde zaten geçmiş bir etkinliktir; silinen plan iptal edilmeli.
  const removed = Object.keys(saved.sig).filter((id) => (id.startsWith('plan:') ? !livePlans.has(id) && saved.sig[id]!.split('|')[0]! >= ref : !byId.has(id))).length;
  // Hâlâ mutfakta ama artık hatırlatılmayan (tarihi geçmişe çekilen) ürünün eski hatırlatıcısı silinmeli.
  for (const [id, sig] of Object.entries(saved.sig)) {
    const it = byId.get(id);
    if (it && !(id in now) && sig.split('|')[0] !== it.useBy) changed++;
  }
  return { added, removed, changed, total: added + removed + changed, leadChanged };
}
