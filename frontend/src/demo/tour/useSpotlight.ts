import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { TourStep } from './steps';

/* The tour's spotlight engine (ported from docs/design/tools/mockup-sources/tour/engine.html):
   - reveal: the target is scrolled fully into view inside every scrollable ancestor (innermost first), then
     the window, 16px margin, instantly; a target taller than its container shows its top;
   - the cut-out is the visible part: the target (or the union of several) intersected with every clipping
     ancestor and the window, padded 6px;
   - re-measured on scroll (capture), resize, a ResizeObserver on the target, and every animation frame;
   - everything outside the card and the target is inert (only what the engine set is restored);
   - the card sits beside the target (preferred sides, then the others); when no side fits it scrolls the
     window to make room, and as a last resort lights only the target's top part so the card never covers it.
   Motion: the cut-out and its ring move with clip-path (220ms), the card fades and slides 8px (180ms),
   both cubic-bezier(.2,.8,.2,1). Reduced motion: instant moves, no slide. */

export interface Rect { l: number; t: number; r: number; b: number; w: number; h: number }
interface Pos { x: number; y: number; dx: number; dy: number; cut?: Rect }

const M = 16, GAP = 16, PAD = 6;
/** Longest a hold between screens may last before the tour gives the page back (a navigation that never lands). */
const HOLD_MAX = 1500;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

const isVisible = (el: Element) => {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
};
/** "a | b": first alternative with a visible match; "a, b": every visible match (union). */
export function queryTargets(sel: string | null): HTMLElement[] | null {
  if (!sel) return null;
  for (const alt of sel.split('|')) {
    const list = [...document.querySelectorAll<HTMLElement>(alt.trim())].filter(isVisible);
    if (list.length) return list;
  }
  return null;
}
function union(list: Element[]) {
  const u = { l: 1e9, t: 1e9, r: -1e9, b: -1e9 };
  list.forEach(e => { const b = e.getBoundingClientRect(); u.l = Math.min(u.l, b.left); u.t = Math.min(u.t, b.top); u.r = Math.max(u.r, b.right); u.b = Math.max(u.b, b.bottom); });
  return u;
}
/** Every ancestor that clips its content (scroll panels, overflow hidden frames), innermost first. */
function clippers(el: Element) {
  const out: HTMLElement[] = [];
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/(auto|scroll|hidden|clip)/.test(cs.overflowY + ' ' + cs.overflowX)) out.push(p);
  }
  return out;
}
const canScroll = (p: HTMLElement) => /(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight + 1;
const inner = (p: HTMLElement) => { const b = p.getBoundingClientRect(); return { l: b.left + p.clientLeft, t: b.top + p.clientTop, r: b.left + p.clientLeft + p.clientWidth, b: b.top + p.clientTop + p.clientHeight }; };

function reveal(list: HTMLElement[]) {
  const delta = (u: { t: number; b: number }, c: { t: number; b: number }) => {
    if (u.b - u.t > c.b - c.t - 2 * M || u.t < c.t + M) return u.t - (c.t + M);
    if (u.b > c.b - M) return u.b - (c.b - M);
    return 0;
  };
  clippers(list[0]).filter(canScroll).forEach(p => {
    const d = delta(union(list), inner(p));
    if (Math.abs(d) > .5) p.scrollTo({ top: p.scrollTop + d, behavior: 'instant' });
  });
  const se = document.scrollingElement ?? document.documentElement;
  if (se.scrollHeight > innerHeight + 1) {
    const d = delta(union(list), { t: 0, b: innerHeight });
    if (Math.abs(d) > .5) window.scrollTo({ top: scrollY + d, behavior: 'instant' });
  }
}
function visRect(list: HTMLElement[]) {
  const u = union(list), v = { l: Math.max(0, u.l), t: Math.max(0, u.t), r: Math.min(innerWidth, u.r), b: Math.min(innerHeight, u.b) };
  clippers(list[0]).forEach(p => { const c = inner(p); v.l = Math.max(v.l, c.l); v.t = Math.max(v.t, c.t); v.r = Math.min(v.r, c.r); v.b = Math.min(v.b, c.b); });
  return v.r - v.l < 2 || v.b - v.t < 2 ? null : v;
}
function measure(list: HTMLElement[] | null): Rect | null {
  if (!list) return null;
  const v = visRect(list);
  if (!v) return null;
  const W = innerWidth, H = innerHeight;
  const r = { l: Math.max(4, v.l - PAD), t: Math.max(4, v.t - PAD), r: Math.min(W - 4, v.r + PAD), b: Math.min(H - 4, v.b + PAD) };
  return { ...r, w: r.r - r.l, h: r.b - r.t };
}
const same = (a: Rect | null, b: Rect | null) => (!a && !b) || (!!a && !!b && Math.abs(a.l - b.l) < 1 && Math.abs(a.t - b.t) < 1 && Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1);

/** A rounded rectangle as path commands (always the same command list, so clip-path can interpolate it). */
function rr(l: number, t: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const f = (n: number) => Math.round(n * 10) / 10;
  return `M${f(l + r)} ${f(t)}H${f(l + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(l + w)} ${f(t + r)}V${f(t + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(l + w - r)} ${f(t + h)}H${f(l + r)}A${f(r)} ${f(r)} 0 0 1 ${f(l)} ${f(t + h - r)}V${f(t + r)}A${f(r)} ${f(r)} 0 0 1 ${f(l + r)} ${f(t)}Z`;
}

/** Card beside the target: preferred sides, then the others; else the target's top part is lit with the card under it; else the corner covering least. */
function place(r: Rect | null, s: TourStep, cw: number, ch: number): Pos & { side: boolean } {
  const W = innerWidth, H = innerHeight;
  const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  if (!r) return { x: (W - cw) / 2, y: (H - ch) / 2, dx: 0, dy: 6, side: true };
  const cx = r.l + r.w / 2, cy = r.t + r.h / 2;
  const c: Record<string, Pos & { ok: boolean }> = {
    right: { x: r.r + GAP, y: cl(cy - ch / 2, M, H - M - ch), dx: -8, dy: 0, ok: r.r + GAP + cw <= W - M },
    left: { x: r.l - GAP - cw, y: cl(cy - ch / 2, M, H - M - ch), dx: 8, dy: 0, ok: r.l - GAP - cw >= M },
    bottom: { x: cl(cx - cw / 2, M, W - M - cw), y: r.b + GAP, dx: 0, dy: -8, ok: r.b + GAP + ch <= H - M },
    top: { x: cl(cx - cw / 2, M, W - M - cw), y: r.t - GAP - ch, dx: 0, dy: 8, ok: r.t - GAP - ch >= M },
  };
  const order = (s.place || 'right left bottom top').split(' ').filter(Boolean).concat(['right', 'left', 'bottom', 'top']);
  for (const k of order) if (c[k]?.ok) return { ...c[k], side: true };
  // no side fits: light the top part (the rest is a scroll away) and put the card under it
  const room = H - M - ch - GAP;
  if (room - r.t >= 56) {
    const cut = { ...r, b: room, h: room - r.t };
    return { x: cl(cx - cw / 2, M, W - M - cw), y: room + GAP, dx: 0, dy: -8, cut, side: false };
  }
  let best: Pos & { a: number } | null = null;
  for (const [x, y] of [[M, M], [W - M - cw, M], [M, H - M - ch], [W - M - cw, H - M - ch]]) {
    const ox = Math.max(0, Math.min(x + cw, r.r) - Math.max(x, r.l)), oy = Math.max(0, Math.min(y + ch, r.b) - Math.max(y, r.t));
    if (!best || ox * oy < best.a) best = { x, y, dx: 0, dy: 6, a: ox * oy };
  }
  return { ...best!, side: false };
}

export function useSpotlight(cardRef: RefObject<HTMLDivElement | null>, rootRef: RefObject<HTMLDivElement | null>) {
  const st = useRef({
    step: null as TourStep | null, list: null as HTMLElement[] | null, rect: null as Rect | null, shown: false, cardPos: null as Pos | null,
    painted: undefined as Rect | null | undefined, inerted: new Set<Element>(), raf: 0, ro: null as ResizeObserver | null, mo: null as MutationObserver | null, dirty: true, relock: 0, holdT: 0,
  });

  const api = useMemo(() => {
    const s = st.current;
    const q = <T extends Element>(sel: string) => rootRef.current?.querySelector<T>(sel) ?? null;

    /* ---- inert lock: everything except the card, the target and floating pickers/tips ---- */
    const unlock = () => { s.inerted.forEach(e => { (e as HTMLElement).inert = false; }); s.inerted.clear(); };
    const lock = () => {
      const list = s.list ?? [], keep = new Set<Element>([document.body]), tg = new Set<Element>(list), want = new Set<Element>();
      list.forEach(t => { for (let n: Element | null = t; n && n !== document.body; n = n.parentElement) keep.add(n); });
      if (!list.length && rootRef.current) for (let n: Element | null = rootRef.current.parentElement; n && n !== document.body; n = n.parentElement) keep.add(n);
      keep.forEach(n => {
        if (tg.has(n)) return;
        for (const c of n.children) {
          if (keep.has(c) || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(c.tagName)) continue;
          if (c.matches('.tour-host,.tour-root,.tour-chip,.cpop,.stip,.sp-tip')) continue;
          if ((c as HTMLElement).inert && !s.inerted.has(c)) continue; // the page's own inert state stays as it is
          want.add(c);
        }
      });
      s.inerted.forEach(e => { if (!want.has(e)) { (e as HTMLElement).inert = false; s.inerted.delete(e); } });
      want.forEach(e => { if (!s.inerted.has(e)) { (e as HTMLElement).inert = true; s.inerted.add(e); } });
    };

    /* ---- painting ---- */
    const setBox = (el: HTMLElement | null, l: number, t: number, w: number, h: number) => {
      if (!el) return;
      el.style.left = l + 'px'; el.style.top = t + 'px'; el.style.width = Math.max(0, w) + 'px'; el.style.height = Math.max(0, h) + 'px';
    };
    const blocks = (r: Rect | null) => {
      const W = innerWidth, H = innerHeight, b = (k: string) => q<HTMLElement>(`.tour-blk[data-b="${k}"]`);
      if (!r) { setBox(b('t'), 0, 0, W, H); ['r', 'b', 'l', 'h'].forEach(k => setBox(b(k), 0, 0, 0, 0)); return; }
      setBox(b('t'), 0, 0, W, r.t); setBox(b('b'), 0, r.b, W, H - r.b); setBox(b('l'), 0, r.t, r.l, r.h); setBox(b('r'), r.r, r.t, W - r.r, r.h);
      // look steps also block the target itself; try and act steps leave it usable
      if (s.step && s.step.kind !== 'look') setBox(b('h'), 0, 0, 0, 0); else setBox(b('h'), r.l, r.t, r.w, r.h);
    };
    const paint = (r: Rect | null, animate: boolean) => {
      const root = rootRef.current;
      if (!root) return;
      const W = innerWidth, H = innerHeight;
      // unchanged cut-out (only the card resized, say): leave a running move alone
      if (s.painted !== undefined && same(s.painted, r) && W === +(root.dataset.w ?? 0) && H === +(root.dataset.h ?? 0)) { blocks(r); return; }
      s.painted = r; root.dataset.w = String(W); root.dataset.h = String(H);
      const h = r ?? { l: W / 2, t: H / 2, r: W / 2, b: H / 2, w: 0, h: 0 };
      const rad = Math.min(h.w, h.h) < 56 ? Math.min(h.w, h.h) / 2 : 16;
      root.toggleAttribute('data-snap', !animate);
      root.toggleAttribute('data-none', !r);
      const hole = rr(h.l, h.t, h.w, h.h, rad);
      const set = (sel: string, d: string) => { const el = q<HTMLElement>(sel); if (el) el.style.clipPath = `path(evenodd, "${d}")`; };
      set('.tour-scrim', `M0 0H${W}V${H}H0Z${hole}`);
      set('.tour-ring.o', rr(h.l - 4, h.t - 4, h.w + 8, h.h + 8, rad + 4) + hole);
      set('.tour-ring.i', rr(h.l - 2, h.t - 2, h.w + 4, h.h + 4, rad + 2) + hole);
      if (!animate) void root.offsetWidth; // apply now, then let later changes animate again
      root.removeAttribute('data-snap');
      blocks(r);
    };
    const moveCard = (p: Pos, slide: boolean) => {
      const card = cardRef.current;
      if (!card) return;
      s.cardPos = p;
      card.setAttribute('data-jump', '');
      if (slide) { card.style.transform = `translate(${Math.round(p.x + p.dx)}px,${Math.round(p.y + p.dy)}px)`; void card.offsetWidth; card.removeAttribute('data-jump'); }
      card.style.transform = `translate(${Math.round(p.x)}px,${Math.round(p.y)}px)`;
      if (!slide) { void card.offsetWidth; card.removeAttribute('data-jump'); }
    };
    const layout = (animate: boolean, slide: boolean) => {
      const card = cardRef.current;
      if (!card || !s.step) return null;
      const r = measure(s.list);
      s.rect = r;
      const p = place(r, s.step, card.offsetWidth, card.offsetHeight);
      paint(p.cut ?? r, animate);
      if (!s.cardPos || Math.abs(p.x - s.cardPos.x) > 1 || Math.abs(p.y - s.cardPos.y) > 1 || slide) moveCard(p, slide);
      return p;
    };

    /* ---- follow the target through resize, scroll, re-render and the page's own transitions ---- */
    const track = () => {
      s.raf = requestAnimationFrame(track);
      if (s.relock) { s.relock = 0; lock(); } // also while held between screens: the new screen mounts inert
      if (!s.shown || !s.step) return;
      // targets the page re-renders are queried again
      if (s.step.sel && (!s.list || s.list.some(e => !e.isConnected))) { s.list = queryTargets(s.step.sel); watch(); lock(); s.dirty = true; }
      const r = measure(s.list);
      if (!s.dirty && same(r, s.rect)) return;
      s.dirty = false;
      layout(false, false);
    };
    const watch = () => {
      s.ro?.disconnect();
      if (!s.ro) s.ro = new ResizeObserver(() => { s.dirty = true; });
      (s.list ?? []).forEach(e => s.ro!.observe(e));
      if (cardRef.current) s.ro.observe(cardRef.current);
    };
    const onScroll = () => { s.dirty = true; };

    const start = () => {
      if (!s.raf) s.raf = requestAnimationFrame(track);
      document.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onScroll);
      if (!s.mo) {
        // React adds and removes nodes while a step is up: keep the lock current
        s.mo = new MutationObserver(() => { s.relock = 1; });
        // the tour lives in its own layer on body, so watch the whole page
        s.mo.observe(document.body, { childList: true, subtree: true });
      }
    };
    const stop = () => {
      cancelAnimationFrame(s.raf); s.raf = 0;
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      s.ro?.disconnect(); s.mo?.disconnect(); s.mo = null;
    };

    return {
      /** Light a step. */
      show(step: TourStep, o: { first: boolean; reduce: boolean; isCurrent: () => boolean; onEnter?: () => void }) {
        const root = rootRef.current, card = cardRef.current;
        window.clearTimeout(s.holdT); s.holdT = 0;
        if (!root || !card) return;
        s.step = step; s.list = queryTargets(step.sel);
        if (s.list) reveal(s.list);
        watch(); lock(); start();
        root.setAttribute('data-on', '');
        const raf2 = (f: () => void) => requestAnimationFrame(() => requestAnimationFrame(f));
        raf2(() => {
          if (!o.isCurrent()) return;
          s.list = queryTargets(step.sel);
          // nothing fits beside the target: scroll the window so the card fits under it (or over it)
          const r0 = measure(s.list), p0 = place(r0, step, card.offsetWidth, card.offsetHeight);
          const se = document.scrollingElement ?? document.documentElement;
          if (r0 && s.list && !p0.side && se.scrollHeight > innerHeight + 1) {
            // the card goes under the target: its top just inside the window (a taller target shows its top part)
            window.scrollTo({ top: scrollY + union(s.list).t - M, behavior: 'instant' });
          }
          requestAnimationFrame(() => {
            if (!o.isCurrent()) return;
            const instant = o.first || o.reduce;
            s.cardPos = null;
            card.removeAttribute('data-st');
            layout(!instant, false);
            s.shown = true; s.dirty = false;
            const enter = () => {
              if (!o.isCurrent()) return;
              layout(false, !o.reduce);
              card.setAttribute('data-st', 'in');
              card.focus({ preventScroll: true });
              o.onEnter?.();
            };
            if (instant) enter(); else window.setTimeout(enter, 80); // the spotlight leads; the card lands with it
          });
        });
      },
      /** Between screens: the card leaves, but the scrim stays up (static) and the whole page stays inert and
          blocked until the next step's target mounts; the cut-out stays where it was and then moves on.
          If the next step has not shown within HOLD_MAX, onStall runs (the tour pauses, so the page is usable again). */
      hold(reduce: boolean, onStall?: () => void) {
        const card = cardRef.current;
        window.clearTimeout(s.holdT);
        s.holdT = window.setTimeout(() => { s.holdT = 0; onStall?.(); }, HOLD_MAX);
        if (card) { if (reduce) card.removeAttribute('data-st'); else if (card.getAttribute('data-st') === 'in') card.setAttribute('data-st', 'out'); }
        s.shown = false; s.list = null; s.rect = null;
        blocks(null);
        lock();
        start();
      },
      /** The card leaves before the next step (the spotlight stays and moves on). */
      leave(reduce: boolean) {
        const card = cardRef.current;
        if (card && !reduce) card.setAttribute('data-st', 'out');
        s.shown = false;
      },
      hide() {
        window.clearTimeout(s.holdT); s.holdT = 0;
        s.shown = false; s.step = null; s.list = null; s.rect = null; s.cardPos = null; s.painted = undefined;
        stop(); unlock();
        rootRef.current?.removeAttribute('data-on');
        cardRef.current?.removeAttribute('data-st');
      },
      /** Tab order inside the lit target (try and act steps only). */
      focusables(): HTMLElement[] {
        if (!s.step || s.step.kind === 'look' || !s.list) return [];
        return s.list.flatMap(t => [...(t.matches(FOCUSABLE) ? [t] : []), ...t.querySelectorAll<HTMLElement>(FOCUSABLE)]).filter(e => !e.closest('[inert]') && e.tabIndex >= 0);
      },
    };
  }, [cardRef, rootRef]);

  useEffect(() => () => api.hide(), [api]);
  return api;
}
