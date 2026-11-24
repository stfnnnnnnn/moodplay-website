import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent as RPointerEvent } from 'react';
import './steps.css';
import './colorize.css';
import { TopBar } from '../chrome/TopBar';
import { HoldButton } from '../chrome/HoldButton';
import { Scene } from '../scene';
import { isColor, useDemo, type SceneObject } from '../store';
import { go } from '../nav';
import { useHoldSpace } from '../parts/HoldSpace';
import { ColorPicker } from '../parts/ColorPicker';
import { reachedFor } from '../parts/flow';
import { EmptyStep } from '../parts/EmptyStep';
import { CLIP, CROP, clipTime2 } from '../format';
import { FrameThumbs } from '../parts/FrameThumbs';

/* Colorize (v5-colorize.html): select an object on the frame or in the list (pink ring in both), then
   Keep original (icon-only first swatch), one of the recent colours, or Custom color (picker, applies live).
   Hold Space / press and hold the eye for the black-and-white original. */

const NAMES: Record<string, string> = { '#C8326B': 'Raspberry', '#E39B2D': 'Amber', '#2F6FD6': 'Cobalt', '#2A9C9C': 'Teal', '#3E9B5C': 'Green', '#EADBC0': 'Cream', '#7A4E2D': 'Brown' };
const DEFAULT_ROW = ['#C8326B', '#E39B2D', '#2F6FD6', '#2A9C9C', '#3E9B5C', '#EADBC0', '#7A4E2D'];
const nameOf = (hex: string) => NAMES[hex.toUpperCase()] ?? 'Custom ' + hex.toUpperCase();

const status = (o: SceneObject) => (o.color === 'retain' ? 'Keep original' : isColor(o.color) ? nameOf(o.color) : 'No color yet');
function Swatch({ o }: { o: SceneObject }) {
  if (o.color === 'retain') return <span className="sw keepi" />;
  if (isColor(o.color)) return <span className="sw" style={{ background: o.color }} />;
  return <span className="sw none" />;
}
const KEEP_ICON = <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#fff" stroke="#4E5A70" strokeWidth="2" /><path d="M12 3a9 9 0 0 1 0 18z" fill="#4E5A70" /></svg>;

export default function Colorize() {
  const { state, dispatch, current } = useDemo();
  const hold = useHoldSpace();
  const objects = useMemo(() => current?.objects ?? [], [current]);
  const [selState, setSel] = useState<number>(() => (objects.find(o => !o.color) ?? objects[0])?.id ?? 1);
  const sel = objects.some(o => o.id === selState) ? selState : objects[0]?.id ?? 1;
  // the row keeps its order while you click through it; a new custom colour joins at the front when the picker closes
  const [row, setRow] = useState<string[]>(() => {
    const r = state.recentColors.map(c => c.toUpperCase());
    return [...r, ...DEFAULT_ROW.filter(c => !r.includes(c))].slice(0, 7);
  });
  const [picker, setPickerState] = useState<{ start: string | null; viaKey: boolean } | null>(null);
  const [live, setLiveState] = useState<string | null>(null); // picker colour, applied live to the selected object
  const pickerRef = useRef(picker), liveRef = useRef(live);
  const setPicker = (p: typeof picker) => { pickerRef.current = p; setPickerState(p); };
  const setLive = useCallback((l: string | null) => { liveRef.current = l; setLiveState(l); }, []);
  const cbtn = useRef<HTMLButtonElement>(null);
  const tip = useSwatchTip();
  const [at, setAt] = useState(48); // the filmstrip frame shown in the header (the viewer itself is one still)

  const shown = useMemo(() => objects.map(o => (live && o.id === sel ? { ...o, color: live } : o)), [objects, live, sel]);
  const cur = shown.find(o => o.id === sel) ?? shown[0];
  const c = cur && isColor(cur.color) ? cur.color.toUpperCase() : null;
  const done = shown.filter(o => isColor(o.color)).length;

  const setColor = (color: string | 'retain') => { if (cur) dispatch({ type: 'setColor', objectId: cur.id, color }); };
  const closePicker = useCallback((refocus: boolean) => {
    const p = pickerRef.current, l = liveRef.current;
    if (!p) return;
    if (l && l !== p.start) {
      dispatch({ type: 'setColor', objectId: sel, color: l });
      setRow(r => (r.includes(l) ? r : [l, ...r].slice(0, 7)));
    }
    liveRef.current = null; setLiveState(null);
    pickerRef.current = null; setPickerState(null);
    if (refocus) requestAnimationFrame(() => cbtn.current?.focus({ preventScroll: true }));
  }, [dispatch, sel]);
  const select = (id: number) => { if (picker) closePicker(false); setSel(id); };
  const toMood = () => { if (current && current.step < 4) dispatch({ type: 'setStep', step: 4 }); go('mood'); };

  const inRow = !!c && row.includes(c);
  const hitStyle = (o: SceneObject): CSSProperties => {
    const [x0, y0raw, x1, y1] = o.box, y0 = o.id === 5 ? Math.max(y0raw, 424) : y0raw; // Person 3: the head, as in the mockup
    return { left: `calc(${(x0 - 310) / 16.8}% - 10px)`, width: `calc(${(x1 - x0) / 16.8}% + 20px)`, top: `calc(${y0 / 9}% - 10px)`, height: `calc(${(y1 - y0) / 9}% + 20px)` };
  };

  if (!cur) {
    return <EmptyStep step={3} reached={reachedFor(current, 3)} title="No objects to color"
      text="Every object was removed in Detect. Go back to Detect to add one, then come back to give it a color." to="detect" action="Back to Detect" />;
  }
  return (
    <>
      <TopBar kind="step" step={3} reached={reachedFor(current, 3)} extra={<HoldButton hold={hold} />} />
      <main className={'sp sp-colorize' + (hold.held ? ' holding' : '')}>
        <section className="sp-stage" aria-label="Frame viewer">
          <div className="viewer cviewer">
            <div className="vbar"><span>Click an object to select it. Its color follows it through every frame.</span><span className="grow" /><span className="chip ochip" aria-hidden="true">Original</span></div>
            <div className="vin"><div className="cframe" data-tour="tut_frame">
              <div className="lay" role="img" aria-label={`Frame ${at}: ${done} of ${shown.length} objects have a color`}><Scene variant="gray" objects={shown} viewBox={CROP} videoSrc={current?.videoSrc} /></div>
              <div className="lay orig" aria-hidden="true"><Scene variant="gray" viewBox={CROP} /></div>
              <div className="hits" aria-hidden="true">
                {shown.map(o => (
                  <button key={o.id} className={'hit' + (o.id === sel ? ' sel' : '')} tabIndex={-1} data-o={o.id} style={hitStyle(o)}
                    data-tour={o.id === 5 ? 'tut_select_object' : undefined} onClick={() => select(o.id)}>
                    <span className="obj" style={o.id === 3 ? { left: 'calc(15.4% - 10px)' } : undefined}>{o.id}</span>
                  </button>
                ))}
              </div>
            </div></div>
          </div>
          <div className="fthumbs card">
            <div className="fhead"><span>Frame <b>{at}</b> of {CLIP.frames}</span><span>{clipTime2(at / CLIP.fps)} / {clipTime2(CLIP.seconds)}</span></div>
            <FrameThumbs objects={shown} at={at} onPick={setAt} label="Frames" itemLabel="Frame " />
          </div>
        </section>

        <aside className="sp-panel card cpanel" aria-label="Colorize controls">
          <div className="ph"><h1>Colorize</h1><p aria-live="polite"><b>{done} of {shown.length}</b> objects have a color</p></div>
          <div className="pbody">
            <h2 className="plbl" id="objLbl">Objects</h2>
            <ul className="olist" aria-labelledby="objLbl">
              {shown.map(o => (
                <li key={o.id}>
                  <button className="orow" type="button" aria-pressed={o.id === sel} aria-label={`${o.label}, ${status(o)}`} onClick={() => select(o.id)}>
                    <span className={'obj' + (o.id === sel ? ' sel' : '')}>{o.id}</span><span className="nm">{o.label}</span><span className="st">{status(o)}</span><Swatch o={o} />
                  </button>
                </li>
              ))}
            </ul>
            <section className="pick" aria-labelledby="pickLbl" data-tour="tut_color_pick">
              <h2 className="plbl" id="pickLbl"><span className="obj">{cur.id}</span><span>Color for {cur.label}</span></h2>
              <p className="sub" id="recentLbl">Recent colors</p>
              <div className="swgrid" role="group" aria-labelledby="recentLbl" {...tip.bind}>
                <button className="swb keepsw" type="button" aria-pressed={cur.color === 'retain'} aria-label="Keep original color" data-tipt="Keep original color"
                  onClick={() => setColor('retain')}>{KEEP_ICON}</button>
                {row.map(hex => (
                  <button key={hex} className="swb" type="button" style={{ background: hex }} data-c={hex} aria-pressed={c === hex}
                    aria-label={`${nameOf(hex)}, ${hex}`} data-tipt={nameOf(hex)} onClick={() => setColor(hex)} />
                ))}
              </div>
              <button ref={cbtn} className={'cbtn' + (c && !inRow ? ' on' : '')} type="button" aria-haspopup="dialog" aria-expanded={!!picker} aria-controls={picker ? 'cpop' : undefined}
                onClick={e => { if (picker) closePicker(true); else { tip.hide(); setPicker({ start: c, viaKey: e.detail === 0 }); } }}>
                <span className={'sw' + (c ? '' : ' none')} style={c ? { background: c } : undefined} /><span>Custom color</span><span className="cv">{c ?? ''}</span>
                <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
              </button>
            </section>
          </div>
          <div className="pfoot">
            <p className="note">Objects with no color stay black and white.</p>
            <button className="btn btn-pink btn-lg full" type="button" id="toMood" onClick={toMood} data-tour="btn_finish">Continue to mood</button>
          </div>
        </aside>
        {picker && (
          <ColorPicker anchor={cbtn} start={picker.start} viaKey={picker.viaKey} onChange={setLive} onClose={closePicker}
            nextFocus={() => document.getElementById('toMood')} />
        )}
        {tip.node}
      </main>
    </>
  );
}

/* Swatch names: a small tooltip on hover (short delay, then instant between swatches) and on keyboard focus. */
function useSwatchTip() {
  const [t, setT] = useState<{ text: string; x: number; y: number; instant: boolean } | null>(null);
  const timer = useRef(0), last = useRef(0);
  const show = (b: HTMLElement, instant: boolean) => {
    const r = b.getBoundingClientRect(), text = b.dataset.tipt ?? '';
    setT({ text, x: r.left + r.width / 2, y: r.top - 8, instant });
  };
  const hide = useCallback(() => { window.clearTimeout(timer.current); setT(p => { if (p) last.current = Date.now(); return null; }); }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const bind = {
    onPointerOver: (e: RPointerEvent) => {
      const b = (e.target as Element).closest<HTMLElement>('.swb');
      if (!b || e.pointerType !== 'mouse') return;
      window.clearTimeout(timer.current);
      if (t || Date.now() - last.current < 400) show(b, true); else timer.current = window.setTimeout(() => show(b, false), 220);
    },
    onPointerLeave: hide,
    onPointerDown: hide,
    onFocus: (e: FocusEvent) => { const b = (e.target as Element).closest<HTMLElement>('.swb'); if (b && b.matches(':focus-visible')) show(b, true); },
    onBlur: hide,
  };
  const node = t ? <div className="stip" aria-hidden="true" data-instant={t.instant ? '' : undefined} style={{ left: t.x, top: t.y }}>{t.text}</div> : null;
  return { bind, hide, node };
}
