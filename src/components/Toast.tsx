import { create } from 'zustand';
import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

interface ToastData {
  id: number;
  text: string;
  undo?: () => void;
  /** İsteğe bağlı ikinci eylem (ör. "Listeye ekle"). */
  action?: { label: string; run: () => void };
  tone?: 'good' | 'neutral';
  top?: boolean;
}

let seq = 0;
export const useToastStore = create<{ toast?: ToastData; show: (t: Omit<ToastData, 'id'>) => void; hide: () => void }>((set) => ({
  // Konum, bildirim çıktığı anda belirlenir: panel açıksa üstte; panel kapanınca zıplamaz.
  // Çağıran konumu zorlayabilir (ör. kapanan panelden sonra altta).
  show: (t) => set({ toast: { ...t, id: ++seq, top: t.top ?? document.body.classList.contains('has-sheet') } }),
  hide: () => set({ toast: undefined }),
}));

export const toast = (t: Omit<ToastData, 'id'>) => useToastStore.getState().show(t);
/** Ekran değişince eski "Geri al" başka ekranda kalmasın. */
export const clearToast = () => useToastStore.getState().hide();

/** Okumaya yetecek kadar: geri alınabilir işlemlerde 12 sn, diğerlerinde metin uzunluğuna göre 4–7 sn. */
const durationFor = (t: ToastData) => (t.undo ? 12000 : Math.min(7000, 4000 + t.text.length * 40));

export function ToastHost() {
  const { toast: t, hide } = useToastStore();
  const paused = useRef(false);
  // Bildirim yeni çıktıysa ya da yer değiştirdiyse kısa süre dokunuş kabul edilmez: başka bir düğmeye (ör. "Tamam") basan parmak yanlışlıkla "Geri al"a basmasın.
  const settledAt = useRef(0);
  useEffect(() => {
    settledAt.current = Date.now() + 450;
  }, [t?.id, t?.top]);
  const settled = () => Date.now() >= settledAt.current;

  useEffect(() => {
    if (!t) return;
    let left = durationFor(t);
    let total = 0;
    const tick = setInterval(() => {
      total += 250;
      // Dokunurken ya da odaktayken bekler ama en fazla 30 sn ekranda kalır.
      if (total >= 30000) return hide();
      if (paused.current) return;
      left -= 250;
      if (left <= 0) hide();
    }, 250);
    return () => clearInterval(tick);
  }, [t, hide]);

  // Ekran okuyucuların duyurması için canlı bölge hep sayfada durur; yalnızca içi değişir.
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {t && (
        <div
          className={`toast ${t.top ? 'toast--top' : ''}`}
          key={t.id}
          onPointerEnter={() => (paused.current = true)}
          onPointerLeave={() => (paused.current = false)}
          onTouchStart={() => (paused.current = true)}
          onTouchEnd={() => (paused.current = false)}
          onFocus={() => (paused.current = true)}
          onBlur={() => (paused.current = false)}
        >
          <span className={`toast__dot ${t.tone === 'good' ? 'is-good' : ''}`} aria-hidden="true">
            <Icon name={t.tone === 'good' ? 'check' : 'info'} size={16} stroke={2.5} />
          </span>
          <span className="toast__text">{t.text}</span>
          {(t.action || t.undo) && (
            <span className="toast__btns">
            {t.action && (
              <button
                type="button"
                className="toast__undo toast__action"
                onClick={() => {
                  if (!settled()) return;
                  t.action?.run();
                  hide();
                }}
              >
                {t.action.label}
              </button>
            )}
            {t.undo && (
              <button
                type="button"
                className="toast__undo"
                onClick={() => {
                  if (!settled()) return;
                  t.undo?.();
                  // Geri alma hiçbir zaman sessiz olmasın (yanlışlıkla dokunulduysa fark edilsin).
                  if (useToastStore.getState().toast?.id === t.id) useToastStore.getState().show({ text: 'Geri alındı' });
                }}
              >
                Geri al
              </button>
            )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
