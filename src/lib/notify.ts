import type { FridgeItem, Settings } from '../types';
import { today } from './dates';
import { isUrgent, urgency } from './freshness';
import { foodImageUrl } from './images';

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

/**
 * Uygulama açıldığında günde en fazla bir kez, acil ürünleri özetleyen bir bildirim gösterir.
 * Döndürdüğü değer bildirimin gösterildiği gündür (gösterilmediyse undefined).
 */
export async function notifyIfNeeded(items: FridgeItem[], settings: Settings): Promise<string | undefined> {
  if (!settings.notifications || !notificationsSupported() || Notification.permission !== 'granted') return;
  const day = today();
  if (settings.lastNotified === day) return;
  const urgent = items.filter((i) => isUrgent(i, settings.leadDays));
  const expired = items.filter((i) => urgency(i, settings.leadDays) === 'expired');
  if (urgent.length === 0 && expired.length === 0) return;
  const names = urgent.slice(0, 3).map((i) => i.name).join(', ');
  const more = urgent.length > 3 ? ` ve ${urgent.length - 3} ürün daha` : '';
  const title = urgent.length === 0 ? `${expired.length} ürünün tarihi geçti` : urgent.length === 1 ? `${urgent[0]!.name} seni bekliyor` : `${urgent.length} ürünün zamanı yaklaşıyor`;
  const body = urgent.length ? `${names}${more}. Bozulmadan değerlendir!` : 'Mutfağını kontrol et.';
  const icon = foodImageUrl((urgent[0] ?? expired[0])!.img);
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon, tag: 'dolap-gunluk' });
    else new Notification(title, { body, icon, tag: 'dolap-gunluk' });
    return day;
  } catch {
    return;
  }
}
