import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Event ini hanya dikirim sekali oleh Chrome, bisa sebelum React tampil,
// jadi ditangkap di level modul lalu dibagikan ke komponen.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ mengaku sebagai Mac, tapi punya layar sentuh
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

/**
 * - 'prompt': browser siap menampilkan dialog install (Chrome/Edge/Android)
 * - 'ios':    iOS Safari, tidak ada dialog; pengguna harus memakai menu Bagikan
 * - 'none':   sudah ter-install, atau browser tidak mendukung
 */
export function usePwaInstall() {
  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    const evt = deferredPrompt;
    await evt.prompt();
    await evt.userChoice;
    deferredPrompt = null; // event hanya bisa dipakai sekali
    notify();
  }, []);

  const mode: 'prompt' | 'ios' | 'none' = isStandalone()
    ? 'none'
    : deferredPrompt
      ? 'prompt'
      : isIos()
        ? 'ios'
        : 'none';

  return { mode, install };
}
