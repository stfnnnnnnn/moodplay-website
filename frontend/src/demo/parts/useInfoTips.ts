import { useEffect, type RefObject } from 'react';

/* Info tips for setting help (v5-upload.html): one shared tip, open at a time.
   Opens on hover (after a short delay; instant when moving between tips), on keyboard focus, and on
   click/tap (stays until Escape, a click elsewhere, or focus leaves). It is fixed to the window so the
   scrolling settings pane never clips it, sits outside the settings card level with the row, and in a
   narrow window goes below the button (above when there is no room). Buttons: .info[data-tip=<help id>]. */
export function useInfoTips(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const scope = host.closest('.v5') ?? document.body;
    const tip = document.createElement('div');
    tip.className = 'sp-tip'; tip.id = 'sp-tip'; tip.setAttribute('role', 'tooltip');
    const say = document.createElement('div');
    say.className = 'sr'; say.style.position = 'fixed'; say.setAttribute('aria-live', 'polite');
    scope.append(tip, say);
    let cur: HTMLElement | null = null, mode = '', showT = 0, hideT = 0, lastClose = 0, sayT = 0;

    const place = () => {
      if (!cur) return;
      const r = cur.getBoundingClientRect(), pane = cur.closest('.p-body');
      if (pane) { const pr = pane.getBoundingClientRect(); if (r.bottom < pr.top + 4 || r.top > pr.bottom - 4) { close(); return; } }
      const W = innerWidth, H = innerHeight, w = tip.offsetWidth, h = tip.offsetHeight, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let x: number, y: number;
      const card = cur.closest('.sp-panel'), cl = card ? card.getBoundingClientRect().left : r.left;
      if (cl - 12 - w >= 8) {
        x = cl - 12 - w; y = Math.max(8, Math.min(H - 8 - h, cy - h / 2)); tip.dataset.side = 'left';
        const ay = Math.max(10, Math.min(h - 10, cy - y));
        tip.style.setProperty('--ay', ay + 'px'); tip.style.setProperty('--ox', '100%'); tip.style.setProperty('--oy', ay + 'px');
      } else {
        const below = r.bottom + 8 + h <= H - 8;
        x = Math.max(8, Math.min(W - 8 - w, cx - 18)); y = below ? r.bottom + 8 : r.top - 8 - h;
        if (!below && y < 8) y = Math.max(8, Math.min(H - 8 - h, r.bottom + 8));
        tip.dataset.side = below ? 'below' : 'above';
        const ax = Math.max(12, Math.min(w - 12, cx - x));
        tip.style.setProperty('--ax', ax + 'px'); tip.style.setProperty('--ox', ax + 'px'); tip.style.setProperty('--oy', below ? '0' : '100%');
      }
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    function close() {
      clearTimeout(showT); clearTimeout(hideT);
      if (!cur) return;
      cur.removeAttribute('data-open'); cur.removeAttribute('aria-describedby'); cur = null; mode = ''; lastClose = Date.now();
      tip.removeAttribute('data-instant'); tip.removeAttribute('data-open');
    }
    const open = (btn: HTMLElement, how: string, instant?: boolean) => {
      clearTimeout(showT); clearTimeout(hideT);
      if (cur && cur !== btn) { cur.removeAttribute('data-open'); cur.removeAttribute('aria-describedby'); }
      const was = !!cur; cur = btn; mode = how;
      tip.textContent = document.getElementById(btn.dataset.tip ?? '')?.textContent ?? '';
      tip.toggleAttribute('data-instant', !!(instant || was || how === 'focus' || Date.now() - lastClose < 400));
      btn.setAttribute('data-open', ''); btn.setAttribute('aria-describedby', 'sp-tip');
      place(); tip.setAttribute('data-open', '');
      if (how === 'click') { say.textContent = ''; clearTimeout(sayT); sayT = window.setTimeout(() => { say.textContent = tip.textContent; }, 60); }
    };
    const btnOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('.info[data-tip]') : null);

    const over = (e: PointerEvent) => {
      const b = btnOf(e.target);
      if (!b || e.pointerType !== 'mouse' || (mode === 'click' && cur === b) || b === cur) return;
      clearTimeout(hideT);
      if (cur && mode === 'click') return;
      if (cur) open(b, 'hover', true);
      else { clearTimeout(showT); showT = window.setTimeout(() => open(b, 'hover'), Date.now() - lastClose < 400 ? 0 : 220); }
    };
    const out = (e: PointerEvent) => {
      const b = btnOf(e.target);
      if (!b || e.pointerType !== 'mouse' || b.contains(e.relatedTarget as Node)) return;
      clearTimeout(showT);
      if (cur === b && mode === 'hover') hideT = window.setTimeout(close, 140);
    };
    const focusIn = (e: FocusEvent) => { const b = btnOf(e.target); if (b && b.matches(':focus-visible')) open(b, 'focus'); };
    const focusOut = (e: FocusEvent) => {
      const b = btnOf(e.target), to = e.relatedTarget as Element | null;
      if (b && cur === b && !(to && to.closest && to.closest('.info,.sp-tip'))) hideT = window.setTimeout(close, 0);
    };
    const click = (e: MouseEvent) => {
      const b = btnOf(e.target);
      if (!b) return;
      e.preventDefault();
      if (cur === b && mode === 'click') { close(); return; }
      open(b, 'click', cur === b);
    };
    const tipEnter = () => clearTimeout(hideT);
    const tipLeave = () => { if (mode === 'hover') hideT = window.setTimeout(close, 140); };
    const down = (e: PointerEvent) => { if (cur && !(e.target instanceof Element && e.target.closest('.info,.sp-tip'))) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && cur) { e.preventDefault(); e.stopPropagation(); close(); } };
    const scroll = () => { if (cur) place(); };

    host.addEventListener('pointerover', over); host.addEventListener('pointerout', out);
    host.addEventListener('focusin', focusIn); host.addEventListener('focusout', focusOut); host.addEventListener('click', click);
    tip.addEventListener('pointerenter', tipEnter); tip.addEventListener('pointerleave', tipLeave);
    document.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('resize', scroll);
    document.addEventListener('scroll', scroll, true);
    return () => {
      clearTimeout(showT); clearTimeout(hideT); clearTimeout(sayT);
      host.removeEventListener('pointerover', over); host.removeEventListener('pointerout', out);
      host.removeEventListener('focusin', focusIn); host.removeEventListener('focusout', focusOut); host.removeEventListener('click', click);
      document.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', scroll);
      document.removeEventListener('scroll', scroll, true);
      tip.remove(); say.remove();
    };
  }, [root]);
}
