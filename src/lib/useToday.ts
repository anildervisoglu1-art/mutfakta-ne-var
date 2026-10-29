import { useEffect, useState } from 'react';
import { today } from './dates';

/**
 * Bugünün tarihi; gece yarısı, uygulamaya geri dönülünce (visibilitychange/focus) güncellenir.
 * Böylece açık kalan uygulama ertesi sabah dünün durumunu göstermez.
 */
export function useToday(): string {
  const [day, setDay] = useState(today);
  useEffect(() => {
    const refresh = () => setDay((d) => (d === today() ? d : today()));
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const timer = setTimeout(refresh, midnight.getTime() - now.getTime());
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, [day]);
  return day;
}
