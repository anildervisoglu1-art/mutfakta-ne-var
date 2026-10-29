import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useToastStore } from './Toast';

let openSheets = 0;
const LEAVE_MS = 260;

const focusables = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="hidden"]), [href], select, textarea, [tabindex]:not([tabindex="-1"])')).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );

/**
 * Alttan açılan panel.
 * - Arka plana dokununca, Esc ile ya da telefonun geri tuşuyla kapanır (açılınca tarihçeye bir adım eklenir).
 * - Kapanırken kısa bir animasyon oynar; bu sürede arkadaki öğelere yanlışlıkla dokunulmaz.
 * - Odak panel içinde kalır ve kapanınca açan öğeye döner.
 */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const lastChildren = useRef<ReactNode>(children);
  if (open) lastChildren.current = children;
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const openedAt = useRef(0);
  const finishLeave = () => {
    setMounted(false);
    setLeaving(false);
  };

  useEffect(() => {
    if (open) {
      openedAt.current = Date.now();
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (!mounted) return;
    setLeaving(true);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Asıl kaldırma animasyon bitince (onAnimationEnd); bu yalnızca yedek.
    const t = setTimeout(finishLeave, reduced ? 0 : LEAVE_MS + 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const id = `${Date.now()}-${Math.random()}`;
    let popped = false;
    window.history.pushState({ ...(window.history.state ?? {}), sheet: id }, '');
    // Panel yukarı kayarken gelen ikinci dokunuş (çift dokunma) panelin içindeki bir düğmeye düşmesin.
    let sheetEl: HTMLDivElement | null = null;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Panel bir sonraki karede çizilmiş olur.
    const block = requestAnimationFrame(() => {
      sheetEl = ref.current;
      if (sheetEl && !reducedMotion) sheetEl.style.pointerEvents = 'none';
    });
    const unblock = setTimeout(() => sheetEl && (sheetEl.style.pointerEvents = ''), reducedMotion ? 0 : 320);

    const onPop = () => {
      if (window.history.state?.sheet !== id) {
        popped = true;
        onCloseRef.current();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const el = ref.current;
      if (!el) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        const list = focusables(el);
        if (list.length === 0) return;
        const first = list[0]!;
        const last = list[list.length - 1]!;
        if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey, true);
    openSheets++;
    document.body.classList.add('has-sheet');
    // Alttaki bildirim panelin düğmelerini örtmesin: üste taşı.
    useToastStore.setState((st) => (st.toast && !st.toast.top ? { toast: { ...st.toast, top: true } } : st));
    return () => {
      cancelAnimationFrame(block);
      clearTimeout(unblock);
      if (sheetEl) sheetEl.style.pointerEvents = '';
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey, true);
      openSheets = Math.max(0, openSheets - 1);
      // Bildirim, panel tamamen inene kadar üstte kalsın; yer değiştirip zıplamasın.
      // Panel kapanınca üstteki bildirim hemen alta iner: başlıktaki "Tamam"ın üstünde kalıp yanlışlıkla "Geri al"a basılmasın.
      if (!openSheets) useToastStore.setState((st) => (st.toast?.top ? { toast: { ...st.toast, top: false } } : st));
      setTimeout(() => !openSheets && document.body.classList.remove('has-sheet'), LEAVE_MS);
      // Kapatma düğmesiyle kapandıysa eklediğimiz tarihçe adımını geri al.
      if (!popped) setTimeout(() => window.history.state?.sheet === id && window.history.back(), 0);
      // Açan öğe silindiyse (ürün bitti) odak listeye döner, sayfa başına düşmez.
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>('.item__main, main h1')?.focus({ preventScroll: true });
    };
  }, [open]);

  // Panel DOM'a girdikten sonra odağı içine al (otomatik odaklı alan varsa ona dokunma).
  useEffect(() => {
    if (!open || !mounted) return;
    const raf = requestAnimationFrame(() => {
      const el = ref.current;
      if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, mounted]);

  if (!mounted) return null;
  return (
    <div className={`sheet-layer ${leaving || (!open && mounted) ? 'is-leaving' : ''}`}>
      {/* Açılıştan hemen sonraki (çift dokunuşun ikinci) dokunuş paneli kapatmasın. */}
      <div className="sheet-backdrop" onClick={() => !leaving && Date.now() - openedAt.current > 350 && onClose()} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref} onAnimationEnd={(e) => leaving && e.animationName === 'sheet-down' && e.target === e.currentTarget && finishLeave()}>
        <div className="sheet__grip" aria-hidden="true" />
        <button type="button" className="icon-btn sheet__close" onClick={onClose} aria-label="Kapat" disabled={leaving}>
          <Icon name="x" size={20} />
        </button>
        {open ? children : lastChildren.current}
      </div>
    </div>
  );
}
