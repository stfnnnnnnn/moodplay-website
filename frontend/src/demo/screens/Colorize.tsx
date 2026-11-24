import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from 'react';
import './steps.css';
import './colorize.css';
import { TopBar } from '../chrome/TopBar';
import { HoldButton } from '../chrome/HoldButton';
import { Scene } from '../scene';
import { isColor, shapeOf, useDemo, type SceneObject } from '../store';
import { hitObject } from '../regionHit';
import { maskUrl, shapePath } from '../sceneRegions';
import { FrontMasks } from '../parts/ShapeMasks';
import { go } from '../nav';
import { useHoldSpace } from '../parts/HoldSpace';
import { ColorPicker } from '../parts/ColorPicker';
import { reachedFor } from '../parts/flow';
import { EmptyStep } from '../parts/EmptyStep';
import { CLIP, CROP, clipTime2 } from '../format';
import { FrameThumbs } from '../parts/FrameThumbs';

/* Colorize (v5-colorize.html): select an object on the frame or in the list (pink ring in both), then
   Keep original (icon-only first swatch), one of the recent colours, or Custom color (picker, applies live).
   Hold Space / press and hold the eye for the black-and-white original. A click on the frame selects the object
   whose exact shape is under the pointer (smallest on top, people in front of buildings; regionHit.ts), and the
   pink ring follows that shape. */
const [CX, , CW, CH] = CROP.split(' ').map(Number); // the frame shows scene x CX..CX+CW, y 0..CH

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
  const [hov, setHov] = useState<number | null>(null); // the object under the mouse (pen too), outlined in blue

  const shown = useMemo(() => objects.map(o => (live && o.id === sel ? { ...o, color: live } : o)), [objects, live, sel]);
  const shaped = useMemo(() => shown.flatMap(o => { const shape = shapeOf(o); return shape ? [{ ...o, shape }] : []; }), [shown]);
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
  const X = (x: number) => ((x - CX) / CW) * 100, Y = (y: number) => (y / CH) * 100;
  // the hit boxes stay for the tour (its target and act) and for programmatic clicks; real clicks are hit-tested by shape
  const hitStyle = (o: SceneObject): CSSProperties => {
    const [x0, y0raw, x1, y1] = o.box, y0 = o.id === 5 ? Math.max(y0raw, 424) : y0raw; // Person 3: the head, as in the mockup
    return { left: `calc(${X(x0)}% - 10px)`, width: `calc(${X(x1) - X(x0)}% + 20px)`, top: `calc(${Y(y0)}% - 10px)`, height: `calc(${Y(y1) - Y(y0)}% + 20px)` };
  };
  // each number badge at its object's top-left corner (the car's sits over its body, as in the mockup), kept inside the frame
  const badgeStyle = (o: SceneObject): CSSProperties => {
    const [x0, y0raw, x1] = o.box, y0 = o.id === 5 ? Math.max(y0raw, 424) : y0raw, x = o.id === 3 ? x0 + (x1 - x0) * .154 : x0;
    return { left: `clamp(2px, calc(${X(x)}% - 10px), calc(100% - 26px))`, top: `clamp(2px, calc(${Y(y0)}% - 10px), calc(100% - 26px))` };
  };
  const at2 = (e: { clientX: number; clientY: number; currentTarget: Element }) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: CX + ((e.clientX - r.left) / r.width) * CW, y: ((e.clientY - r.top) / r.height) * CH };
  };
  const hitAt = (e: { clientX: number; clientY: number; currentTarget: Element }) => {
    const p = at2(e);
    return hitObject(shaped, p.x, p.y);
  };
  const onFrameClick = (e: RMouseEvent<HTMLDivElement>) => {
    if (e.detail === 0) return; // a programmatic click (the tour's Next) already selected its object
    const o = hitAt(e);
    if (o) select(o.id);
  };
  const onFrameMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const id = hitAt(e)?.id ?? null;
    if (id !== hov) setHov(id);
  };
  const ring = cur ? shaped.find(o => o.id === cur.id) : null, over = hov != null && hov !== sel ? shaped.find(o => o.id === hov) : null;
  const maskOf = (o: { shape: SceneObject['shape'] }) => (o.shape.kind === 'region' ? maskUrl('cm', o.shape.id) : undefined);

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
              <svg className="csel" viewBox={CROP} preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <defs><FrontMasks prefix="cm" /></defs>
                {over ? <g className="hov" mask={maskOf(over)}><path className="under" d={shapePath(over.shape)} /><path className="edge" d={shapePath(over.shape)} /></g> : null}
                {ring ? <g key={ring.id} className="ring" mask={maskOf(ring)}><path className="under" d={shapePath(ring.shape)} /><path className="edge" d={shapePath(ring.shape)} /></g> : null}
              </svg>
              <div className={'hits' + (hov != null ? ' over' : '')} aria-hidden="true" onClick={onFrameClick} onPointerMove={onFrameMove} onPointerLeave={() => setHov(null)}>
                {shown.map(o => (
                  <button key={o.id} className={'hit' + (o.id === sel ? ' sel' : '')} tabIndex={-1} data-o={o.id} style={hitStyle(o)}
                    data-tour={o.id === 5 ? 'tut_select_object' : undefined} onClick={e => { if (e.detail === 0) select(o.id); }} />
                ))}
              </div>
              <div className="cbadges" aria-hidden="true">
                {shown.map(o => <span key={o.id} className={'obj cbadge' + (o.id === sel ? ' sel' : '')} style={badgeStyle(o)}>{o.id}</span>)}
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
