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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
