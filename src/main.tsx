import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
import './styles/tokens.css';
import './styles/base.css';
import './styles/fridge.css';
import './styles/screens.css';
import './styles/add.css';
import './styles/item.css';
import './styles/cook.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useFridge } from './store/useFridge';

// Başka bir sekme/pencere (ör. yüklü uygulama ve tarayıcı) veriyi değiştirince yeniden oku; birbirinin kaydını ezmesin.
window.addEventListener('storage', (e) => {
  if (e.key === 'dolapta-ne-var') void useFridge.persist.rehydrate();
});
// Tarayıcı (özellikle iOS Safari) yerel veriyi kendiliğinden silmesin.
void navigator.storage?.persist?.().catch(() => undefined);
// Ana ekrandaki uygulama (iOS) arka plandan dönünce yeniden yüklenmez; güncellemeyi her öne gelişte kontrol et.
// Yeni sürüm bulunursa otomatik güncelleme sayfayı yeniler (veri korunur).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !navigator.onLine) return;
  void navigator.serviceWorker
    ?.getRegistration()
    .then((r) => r?.update())
    .catch(() => undefined);
});
// Yeni sürüm devreye girince bir kez yenile (ilk kurulumda değil).
if (navigator.serviceWorker?.controller) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
