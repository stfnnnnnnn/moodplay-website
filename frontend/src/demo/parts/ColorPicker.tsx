import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/* Custom color picker (v5-colorize.html): saturation/brightness square + hue slider + hex field.
   Applies live (onChange on every step). Done, Enter in the hex field, Escape, a click outside or tabbing
   out closes it (onClose). It is fixed to the window (the scrolling panel never clips it), opens above the
   button (below when there is no room) and scales from the button. Keyboard: arrows move the knob by 1%
   (Shift: 10%), Home/End = saturation 0/100, PageUp/PageDown = brightness 100/0. */

function hsv2hex(h: number, s: number, v: number): string {
  const f = (n: number) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return '#' + [f(5), f(3), f(1)].map(x => ('0' + Math.round(x * 255).toString(16)).slice(-2)).join('').toUpperCase();
}
function hex2hsv(c: string): [number, number, number] {
  const r = parseInt(c.substr(1, 2), 16) / 255, g = parseInt(c.substr(3, 2), 16) / 255, b = parseInt(c.substr(5, 2), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
}
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function ColorPicker({ anchor, start, viaKey, onChange, onClose, nextFocus }: {
  anchor: RefObject<HTMLElement | null>;
  /** The object's colour when the picker opened (null = none yet; the square starts at amber). */
  start: string | null;
  viaKey: boolean;
  onChange: (hex: string) => void;
  /** refocus = return focus to the Custom color button. */
  onClose: (refocus: boolean) => void;
  /** Where Tab goes after Done (the popover lives at the end of the page). */
  nextFocus?: () => HTMLElement | null;
}) {
  const init = hex2hsv(start ?? '#E39B2D');
  const [hsv, setHsv] = useState<[number, number, number]>(init);
  const [hex, setHex] = useState(start ? start.slice(1) : '');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  // above the tour's scrim when the tour is up (its host is a later .v5 layer on body); chosen once per open,
  // so the tour layer coming or going while the picker is open never remounts it
  const [host] = useState<HTMLElement>(() => document.querySelector<HTMLElement>('.v5.tour-host') ?? (anchor.current?.closest('.v5') as HTMLElement | null) ?? document.body);
  const pop = useRef<HTMLDivElement>(null);
  const sv = useRef<HTMLDivElement>(null);
  const [H, S, V] = hsv;
  const cur = hsv2hex(H, S, V);

  const apply = (next: [number, number, number], syncHex = true) => {
    setHsv(next);
    const c = hsv2hex(...next);
    if (syncHex) { setHex(c.slice(1)); setErr(''); }
    onChange(c);
  };

  // place above the button (below when there is no room), never off-window; scale from the button
  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current, p = pop.current;
      if (!a || !p) return;
      const r = a.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight, W = innerWidth, Hh = innerHeight;
      const x = Math.max(8, Math.min(W - 8 - w, r.right - w)), above = r.top - 8 - h >= 8;
      const y = above ? r.top - 8 - h : Math.min(Hh - 8 - h, r.bottom + 8);
      p.style.left = x + 'px'; p.style.top = Math.max(8, y) + 'px';
      p.style.setProperty('--ox', r.left + r.width / 2 - x + 'px'); p.style.setProperty('--oy', above ? '100%' : '0');
    };
    place();
    const raf = requestAnimationFrame(() => { setOpen(true); sv.current?.focus({ preventScroll: true }); });
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', place); document.removeEventListener('scroll', place, true); };
  }, [anchor]);

  // outside press and Escape close it before anything else on the page hears them
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !anchor.current?.contains(t)) onClose(false);
    };
    const key = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(true); } };
    document.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key, true); };
  }, [anchor, onClose]);

  const fromPoint = (x: number, y: number) => {
    const r = sv.current!.getBoundingClientRect();
    apply([H, clamp01((x - r.left) / r.width), 1 - clamp01((y - r.top) / r.height)]);
  };
  const svDown = (e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault(); sv.current?.focus({ preventScroll: true });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    fromPoint(e.clientX, e.clientY);
  };
  const svMove = (e: RPointerEvent<HTMLDivElement>) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPoint(e.clientX, e.clientY); };
  const svKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); onClose(false); anchor.current?.focus(); return; }
    const st = e.shiftKey ? .1 : .01;
    let s = S, v = V;
    switch (e.key) {
      case 'ArrowLeft': s -= st; break; case 'ArrowRight': s += st; break;
      case 'ArrowUp': v += st; break; case 'ArrowDown': v -= st; break;
      case 'Home': s = 0; break; case 'End': s = 1; break;
      case 'PageUp': v = 1; break; case 'PageDown': v = 0; break;
      default: return;
    }
    e.preventDefault(); apply([H, clamp01(s), clamp01(v)]);
  };
  const check = () => {
    const v = hex.replace(/^#/, '').trim();
    if (v && !/^[0-9a-f]{6}$/i.test(v)) { setErr('Use 6 characters, like E39B2D.'); return false; }
    return true;
  };
  const onHex = (raw: string) => {
    setHex(raw); setErr('');
    const v = raw.replace(/^#/, '').trim();
    if (/^[0-9a-f]{6}$/i.test(v)) { const c = '#' + v.toUpperCase(); setHsv(hex2hsv(c)); onChange(c); }
  };

  return createPortal(
    <div ref={pop} className="cpop" id="cpop" role="dialog" aria-labelledby="cpopT" data-open={open ? '' : undefined} data-instant={viaKey ? '' : undefined}
      onBlur={e => { const t = e.relatedTarget as Node | null; if (t && !pop.current?.contains(t) && t !== anchor.current) onClose(false); }}>
      <h3 id="cpopT">Custom color</h3>
      <div ref={sv} className="sv" tabIndex={0} role="slider" aria-label="Saturation and brightness" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round(S * 100)} aria-valuetext={`Saturation ${Math.round(S * 100)}%, brightness ${Math.round(V * 100)}%`}
        style={{ '--h': Math.round(H) } as CSSProperties} onPointerDown={svDown} onPointerMove={svMove} onKeyDown={svKey}>
        <span className="knob" style={{ left: S * 100 + '%', top: (1 - V) * 100 + '%', background: cur }} />
      </div>
      <input className="hue" type="range" min={0} max={359} step={1} aria-label="Hue" value={Math.round(H) % 360}
        aria-valuetext={(Math.round(H) % 360) + ' degrees'} style={{ '--h': Math.round(H) } as CSSProperties}
        onChange={e => apply([+e.target.value, S, V])} />
      <div className="pk-foot">
        <label htmlFor="hex">Hex</label>
        <span className={'hexbox' + (err ? ' bad' : '')}>
          <span className="hash" aria-hidden="true">#</span>
          <input id="hex" maxLength={7} autoComplete="off" spellCheck={false} aria-describedby="hexErr" aria-invalid={err ? true : undefined}
            value={hex} onChange={e => onHex(e.target.value)} onBlur={check}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (check()) onClose(true); } }} />
        </span>
        <button className="btn btn-line cdone" type="button" onClick={() => onClose(true)}
          onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { const n = nextFocus?.(); if (n) { e.preventDefault(); onClose(false); n.focus(); } } }}>Done</button>
      </div>
      <p className="err" id="hexErr" aria-live="polite">{err}</p>
    </div>,
    host,
  );
}
