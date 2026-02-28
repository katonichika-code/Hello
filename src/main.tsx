import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Request persistent storage to reduce IndexedDB eviction risk on constrained browsers.
if (navigator.storage?.persist) {
  void navigator.storage.persist().then((granted) => {
    if (granted) {
      console.log('[Storage] Persistent storage granted');
    } else {
      console.log('[Storage] Persistent storage denied — data may be evicted by browser');
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
