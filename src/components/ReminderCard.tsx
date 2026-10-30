import { useState } from 'react';
import { useFridge } from '../store/useFridge';
import { calendarChanges } from '../lib/calendar';
import { Icon } from './Icon';

/**
 * Ana ekrandaki tek hatırlatma kartı (ipucu kartıyla aynı anda gösterilmez):
 * - hiç kurulmadıysa "Telefon hatırlatmalarını ayarla" (kapatılabilir),
 * - dosya indirildi ama eklendiği onaylanmadıysa "Takvimine ekledin mi?",
 * - takvime aktarımdan sonra ürünler değiştiyse "Hatırlatıcılar güncel değil".
 */
export function ReminderCard({ today }: { today: string }) {
  const items = useFridge((s) => s.items);
  const settings = useFridge((s) => s.settings);
  const plans = useFridge((s) => s.plans);
  const setSettings = useFridge((s) => s.setSettings);
  const [later, setLater] = useState(false);
  const cal = settings.calendar;
  // Mutfak boşalsa da (her şeyi sil) takvimdeki eski hatırlatıcılar için uyarı gösterilir.
  // Onaylanmış takvim değiştiyse ipucu kartından bağımsız gösterilir (eski hatırlatıcılar telefonda duruyor).
  if (later || (cal?.status !== 'confirmed' && (!settings.legendSeen || items.length === 0))) return null;

  if (cal?.status === 'confirmed') {
    const ch = calendarChanges(items, cal, settings.leadDays, today, plans);
    if (ch.total === 0) return null;
    return (
      <Card onClose={() => setLater(true)} closeLabel="Şimdilik gizle">
        <strong>Takvimdeki hatırlatıcılar güncel değil.</strong> {ch.leadChanged ? 'Uyarı süresini değiştirdin; ' : 'Son dosyadan sonra '}{ch.total} ürünün hatırlatıcısı değişti.{' '}
        <a href="#/ayarlar">Yeni dosya hazırla</a>
      </Card>
    );
  }
  if (cal?.status === 'prepared') {
    return (
      <Card onClose={() => setLater(true)} closeLabel="Şimdilik gizle">
        <strong>Takvim dosyası hazırlandı.</strong> Takvimine ekledin mi?{' '}
        <button type="button" className="link-btn" onClick={() => setSettings({ calendar: { ...cal, status: 'confirmed' } })}>
          Evet, ekledim
        </button>
      </Card>
    );
  }
  if (settings.reminderCardDismissed || settings.notifications) return null;
  return (
    <Card onClose={() => setSettings({ reminderCardDismissed: true })} closeLabel="Kartı kapat">
      <strong>Telefon hatırlatmalarını ayarla.</strong> Uygulama kapalıyken de son günler takviminde çıksın.{' '}
      <a href="#/ayarlar">Ayarla</a>
    </Card>
  );
}

function Card({ children, onClose, closeLabel }: { children: React.ReactNode; onClose: () => void; closeLabel: string }) {
  return (
    <aside className="legend-card legend-card--cal">
      <span className="legend-card__icon" aria-hidden="true">
        <Icon name="bell" size={20} />
      </span>
      <p>{children}</p>
      <button type="button" className="icon-btn legend-card__close" onClick={onClose} aria-label={closeLabel}>
        <Icon name="x" size={16} />
      </button>
    </aside>
  );
}
