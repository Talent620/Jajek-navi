import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Service Worker dla offline'owych kafli mapy — TYLKO w przeglądarce.
// Na natywnym Capacitorze SW bywa zawodny i może zakłócać start aplikacji,
// więc go tam nie rejestrujemy (offline-tiles to funkcja dodatkowa).
const isNativeApp =
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor?.isNativePlatform?.() === true;
if (!isNativeApp && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline mapy niedostępne — nieblokujące */
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
