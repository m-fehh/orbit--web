'use client';

import { create } from 'zustand';

const KEY = 'orbit.notif-prefs.v1';

export interface NotifPrefs {
  /** Exibir notificação nativa do navegador ao receber. */
  desktop: boolean;
  /** Tocar um som curto ao receber. */
  sound: boolean;
}

const DEFAULTS: NotifPrefs = { desktop: false, sound: false };

function read(): NotifPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

interface NotifPrefsState extends NotifPrefs {
  set: <K extends keyof NotifPrefs>(key: K, value: NotifPrefs[K]) => void;
  hydrate: () => void;
}

export const useNotifPrefs = create<NotifPrefsState>((set) => ({
  ...DEFAULTS,
  set: (key, value) => {
    set({ [key]: value } as Partial<NotifPrefsState>);
    if (typeof window !== 'undefined') {
      try {
        const next = { ...read(), [key]: value };
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch { /* ignore */ }
    }
  },
  hydrate: () => set({ ...read() }),
}));

/** Permissão atual do navegador para notificações nativas. */
export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** Solicita permissão de notificações ao navegador. */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Toca um beep curto via WebAudio (sem depender de arquivo de áudio). */
export function playNotificationSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    osc.onended = () => ctx.close().catch(() => {});
  } catch { /* ignore */ }
}

/** Mostra uma notificação nativa do navegador, se permitido. */
export function showDesktopNotification(title: string, body?: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: 'orbit-notification' });
  } catch { /* ignore */ }
}
