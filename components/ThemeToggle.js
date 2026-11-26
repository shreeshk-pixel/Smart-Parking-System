'use client';
// Light / dark mode switch. The choice is saved in localStorage ("sp-theme"); with no saved choice the app
// follows the system setting. The first paint is handled by the inline script in app/layout.js (no flash).
import { useEffect, useState } from 'react';
import { Ico } from './Icons';

export function useTheme() {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    const root = document.documentElement;
    setTheme(root.dataset.theme || 'light');
    const onChange = (e) => setTheme(e.detail);
    document.addEventListener('themechange', onChange);
    // If the user never picked, keep following the OS when it changes
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onOs = (e) => { let saved = null; try { saved = localStorage.getItem('sp-theme'); } catch {} if (!saved) applyTheme(e.matches ? 'dark' : 'light'); };
    mq.addEventListener('change', onOs);
    return () => { document.removeEventListener('themechange', onChange); mq.removeEventListener('change', onOs); };
  }, []);
  return theme;
}

export function applyTheme(t, save) {
  document.documentElement.dataset.theme = t;
  if (save) { try { localStorage.setItem('sp-theme', t); } catch {} }
  document.dispatchEvent(new CustomEvent('themechange', { detail: t }));
}

const toggle = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);

// variant="switch": sidebar row with a label and a switch; variant="icon": round sun / moon button
export default function ThemeToggle({ variant = 'icon' }) {
  const theme = useTheme();
  if (variant === 'switch') {
    return (
      <button type="button" className="theme-toggle" onClick={toggle}>
        <Ico name="sun" className="ico sun" /><Ico name="moon" className="ico moon" />
        <span className="theme-label">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span><span className="switch" aria-hidden="true" />
      </button>
    );
  }
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label="Toggle dark mode">
      <Ico name="sun" className="ico sun" /><Ico name="moon" className="ico moon" />
    </button>
  );
}
