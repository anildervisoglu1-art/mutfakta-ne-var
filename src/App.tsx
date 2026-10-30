import { useEffect, useRef, useState } from 'react';
import { Home } from './screens/Home';
import { Cook } from './screens/Cook';
import { Stats } from './screens/Stats';
import { Settings } from './screens/Settings';
import { AddScreen, type AddPreset } from './screens/AddScreen';
import { ItemSheet } from './screens/ItemSheet';
import { Icon, type IconName } from './components/Icon';
import { ToastHost, clearToast } from './components/Toast';
import { useFridge } from './store/useFridge';
import { isUrgent, urgency } from './lib/freshness';
import { notifyIfNeeded } from './lib/notify';
import { useToday } from './lib/useToday';

type Tab = 'dolap' | 'pisir' | 'ozet' | 'ayarlar';
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'dolap', label: 'Mutfağım', icon: 'fridge' },
  { id: 'pisir', label: 'Tarifler', icon: 'chef' },
  { id: 'ozet', label: 'Özet', icon: 'chart' },
  { id: 'ayarlar', label: 'Ayarlar', icon: 'settings' },
];

const readHash = (): { tab: Tab; adding: boolean } => {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h === 'ekle') return { tab: 'dolap', adding: true };
  return {
    tab: (TABS.some((t) => t.id === h) ? h : 'dolap') as Tab,
    adding: false,
  };
};

export function App() {
  const [{ tab, adding }, setRoute] = useState(readHash);
  const [itemId, setItemId] = useState<string | null>(null);
  /** Ekleme ekranında hazır yazılı gelecek ad (ör. alışveriş listesinden "Mutfağa ekle"). */
  const [addPreset, setAddPreset] = useState<AddPreset | undefined>(undefined);
  const opener = useRef<HTMLElement | null>(null);
  const prevHash = useRef(window.location.hash);
  const items = useFridge((s) => s.items);
  const settings = useFridge((s) => s.settings);
  const day = useToday();
  const attention = items.filter((i) => isUrgent(i, settings.leadDays, day) || urgency(i, settings.leadDays, day) === 'expired').length;

  useEffect(() => {
    // Tanınmayan adresi temizle.
    const h = window.location.hash.replace(/^#\/?/, '');
    if (h && h !== 'ekle' && !TABS.some((t) => t.id === h)) window.location.replace('#/dolap');
    prevHash.current = window.location.hash;
    const on = () => {
      const fromAdd = prevHash.current === '#/ekle';
      prevHash.current = window.location.hash;
      const h2 = window.location.hash.replace(/^#\/?/, '');
      if (h2 && h2 !== 'ekle' && !TABS.some((t) => t.id === h2)) return window.location.replace('#/dolap');
      setRoute(readHash());
      setItemId(null);
      // Ekleme ekranından dönünce "… eklendi · Geri al" kaybolmasın.
      if (!fromAdd) clearToast();
    };
    // Kendi eklediğimiz tarihçe adımlarından dönülünce de rota güncellensin.
    // Ekleme ekranındaki paneller geri gidince arkadaki sekme değişmesin (Tarifler sıfırlanmasın).
    const onPop = () => {
      const r = readHash();
      setRoute((prev) => (r.adding ? { ...prev, adding: true } : r));
    };
    // Panel açıkken sayfa yenilendiyse tarihçede kalan panel adımını temizle.
    if (window.history.state?.sheet) window.history.back();
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  // Günde bir özet bildirimi: açılışta ve gün değişince/uygulamaya dönülünce.
  useEffect(() => {
    const s = useFridge.getState();
    void notifyIfNeeded(s.items, s.settings, s.plans).then((d) => d && useFridge.getState().setSettings({ lastNotified: d }));
  }, [day]);

  useEffect(() => {
    if (!adding) window.scrollTo({ top: 0 });
    const label = adding ? 'Ürün ekle' : TABS.find((t) => t.id === tab)!.label;
    document.title = `${label} · Mutfakta Ne Var?`;
  }, [tab, adding]);

  // Ekleme ekranı açıkken arkadaki içerik odak ve dokunmaya kapalı.
  useEffect(() => {
    document.querySelector('.app__content')?.toggleAttribute('inert', adding);
  }, [adding]);

  const go = (t: Tab) => {
    if (t !== tab) window.location.hash = `/${t}`;
  };
  const openAdd = (query?: unknown) => {
    // Düğmeden doğrudan bağlanınca olay nesnesi gelebilir: yalnızca ad taşıyan hazır ürün kabul edilir.
    const p = query as AddPreset | undefined;
    setAddPreset(p && typeof p === 'object' && typeof p.name === 'string' && p.name.trim() ? p : undefined);
    opener.current = document.activeElement as HTMLElement | null;
    window.history.pushState({ fromApp: true }, '', '#/ekle');
    prevHash.current = '#/ekle';
    setRoute({ tab, adding: true });
  };
  const closeAdd = () => {
    setAddPreset(undefined);
    if (window.history.state?.fromApp) window.history.back();
    else {
      window.location.replace('#/dolap');
      setRoute({ tab: 'dolap', adding: false });
    }
    // Odak, ekleme ekranını açan düğmeye döner.
    setTimeout(() => (opener.current && document.contains(opener.current) ? opener.current : document.querySelector<HTMLElement>('.fab'))?.focus({ preventScroll: true }), 60);
  };

  return (
    <div className="app">
      <div className="app__content">
        {tab === 'dolap' && <Home onAdd={openAdd} onOpenItem={setItemId} onCook={() => go('pisir')} />}
        {tab === 'pisir' && <Cook onAdd={openAdd} />}
        {tab === 'ozet' && <Stats />}
        {tab === 'ayarlar' && <Settings />}

        <nav className="tabbar" aria-label="Ana menü">
          {TABS.slice(0, 2).map((t) => (
            <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => go(t.id)} badge={t.id === 'dolap' ? attention : 0} />
          ))}
          <button type="button" className="fab" onClick={() => openAdd()} aria-label="Ürün ekle">
            <Icon name="plus" size={28} stroke={2.6} />
          </button>
          {TABS.slice(2).map((t) => (
            <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => go(t.id)} />
          ))}
        </nav>
      </div>

      {adding && <AddScreen onClose={closeAdd} preset={addPreset} />}
      <ItemSheet id={itemId} onClose={() => setItemId(null)} onShow={setItemId} />
      <ToastHost />
    </div>
  );
}

function TabButton({ t, active, onClick, badge = 0 }: { t: (typeof TABS)[number]; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button
      type="button"
      className={`tab ${active ? 'is-active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      // Çok dar ekranda yazı gizlense de ekran okuyucu sekmenin adını duyar.
      aria-label={badge > 0 ? `${t.label}, ${badge} ürün için kullanım ya da karar gerekiyor` : t.label}
    >
      <span className="tab__icon">
        <Icon name={t.icon} size={24} stroke={active ? 2.3 : 1.9} />
        {badge > 0 && (
          <span className="tab__badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </span>
      <span className="tab__label">
        {t.label}
        {badge > 0 && <span className="visually-hidden">, {badge} ürün için kullanım ya da karar gerekiyor</span>}
      </span>
    </button>
  );
}
