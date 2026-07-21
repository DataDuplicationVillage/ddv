import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';

const rootEl = document.getElementById('root');

if (!rootEl) {
  throw new Error('Root element "#root" is missing in index.html');
}

const renderFatal = (title: string, detail: string) => {
  rootEl.innerHTML = `
    <div style="min-height:100vh;background:#0b0b0d;color:#e5e7eb;font-family:ui-sans-serif,system-ui,sans-serif;padding:24px;display:flex;align-items:center;justify-content:center;">
      <div style="max-width:880px;width:100%;background:#17171b;border:1px solid #2a2a2e;border-radius:12px;padding:20px;">
        <h1 style="margin:0 0 10px;font-size:18px;color:#fda4af;">${title}</h1>
        <p style="margin:0 0 10px;font-size:13px;color:#cbd5e1;">The application failed during startup. Check browser console and network panel.</p>
        <pre style="margin:0;padding:12px;background:#0f0f12;border:1px solid #2a2a2e;border-radius:8px;font-size:12px;color:#fecaca;white-space:pre-wrap;word-break:break-word;">${detail}</pre>
      </div>
    </div>
  `;
};

window.addEventListener('error', (event) => {
  const detail = event.error?.stack || event.message || 'Unknown window error';
  renderFatal('Startup Error', detail);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const detail = typeof reason === 'string' ? reason : reason?.stack || JSON.stringify(reason, null, 2);
  renderFatal('Unhandled Promise Rejection', detail || 'Unknown promise rejection');
});

import('./App.tsx')
  .then(({default: App}) => {
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error) => {
    renderFatal('Failed to Load App Module', error?.stack || String(error));
  });
