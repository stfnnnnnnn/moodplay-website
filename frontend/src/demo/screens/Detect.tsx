import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import './steps.css';
import './detect.css';
import { TopBar } from '../chrome/TopBar';
import { IconCheck } from '../chrome/Icons';
import { Scene } from '../scene';
import { LIMITS, makeObjects, shapeOf, useDemo, useDemoExtra, type SceneObject } from '../store';
import { CLIP, clipTimeNear as fmt, num as n, wordLower } from '../format';
import { go } from '../nav';
import { prefersReducedMotion } from '../ui';
import { ObjectLanes, type Gap } from '../parts/ObjectLanes';
import { StopConfirm } from '../parts/StopConfirm';
import { flow, reachedFor } from '../parts/flow';
import { KIND_NOUN, REGION, boundPoly, findRegions, maskUrl, norm, shapeBox, shapePath, type Region, type RegionId, type Shape } from '../sceneRegions';
import { areaOf, hitObject, hitRegion, inShape, maskOf, snapRegion } from '../regionHit';
import { FrontMasks } from '../parts/ShapeMasks';

const maskFor = (id: RegionId) => maskUrl('dm', id);

/* Detect (v5-detect.html): simulated detection with progress along the filmstrip and the frame outlined,
   then the object list (rename, remove + Undo, "Check gap"), object lanes with hatched gaps (click = jump),
   and the frame tools. Every object is outlined with its exact shape (sceneRegions.ts, the scene's
   "instance masks"): clicking inside a shape selects it (smallest on top, like the app's mask hit test),
   clicking an unmarked thing adds it with its edges found, "+ Add area" adds with Auto / Rectangle /
   Free shape (a drawn shape snaps to the thing it mostly covers, IoU ≥ 0.5, or stays a custom area),
   "− Remove area" takes the selected object out of this frame, and add by name runs a short detection that
   marks every match. "Stop detecting" asks first, like Render's Cancel (ruling R8). */

type Box = [number, number, number, number];
interface DetObj {
  id: number; name: string; box: Box; shape: Shape; gaps: Gap[]; color: SceneObject['color'];
  partial?: number; pending?: boolean; fresh?: boolean;
}
type Mode = 'pick' | 'add' | 'sub';
type Tool = 'auto' | 'rect' | 'free';

const DUR = CLIP.seconds, FRAMES = CLIP.frames, RUN_MS = 7000, SCAN_MS = 1600, SNAP = .5;
const pct = (o: DetObj) => Math.round((1 - o.gaps.reduce((s, g) => s + g[1] - g[0], 0)) * 100);
const inGap = (o: DetObj, t: number) => o.gaps.find(g => t >= g[0] && t < g[1]);
const firstSeen = (o: DetObj) => { let t = 0; for (const g of [...o.gaps].sort((a, b) => a[0] - b[0])) { if (g[0] <= t + 1e-6) t = Math.max(t, g[1]); else break; } return t; };
const P = (v: number, of: number) => (v / of) * 100 + '%';
/* A badge sits on its box's top-left corner, kept inside the frame (cqw = the frame's width; the frame is a size
   container, 2100 × 900 scene units, so 1 unit = 1/21 cqw across and down). */
const badgeAt = (b: Box): CSSProperties => ({
  left: `clamp(${-b[0] / 21}cqw + 2px, -12px, ${(2100 - b[0]) / 21}cqw - 26px)`,
  top: `clamp(${-b[1] / 21}cqw + 2px, -12px, ${(900 - b[1]) / 21}cqw - 26px)`,
});
const CHECK = <IconCheck size={11} />;
const regionOf = (o: DetObj): Region | null => (o.shape.kind === 'region' ? REGION[o.shape.id] : null);
const listNames = (names: string[]) => (names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
/** Enter on a focused control activates that control; it must not also close a half-drawn shape. */
const onControl = (t: EventTarget | null) => t instanceof Element && !!t.closest('button, a, input, textarea, select, [role=radio], [role=slider], [tabindex]:not([tabindex="-1"])');


/** What Detect hands back to the project: settled objects (a scan still running is left out). */
const toSceneObjects = (list: DetObj[]): SceneObject[] => list.filter(o => !o.pending).map(o => ({ id: o.id, label: o.name, color: o.color, box: o.box, shape: o.shape }));

function initial(objects: SceneObject[]): DetObj[] {
  return objects.map(o => {
    const s = shapeOf(o);
    const shape: Shape = s ?? { kind: 'poly', pts: boundPoly([o.box[0], o.box[1], o.box[2], o.box[1], o.box[2], o.box[3], o.box[0], o.box[3]]) ?? [0, 0, 10, 0, 10, 10] };
    const r = shape.kind === 'region' ? REGION[shape.id] : null;
    return { id: o.id, name: o.label, box: [...o.box] as Box, shape, gaps: r ? r.gaps.map(g => [...g] as Gap) : [], partial: r?.partial, color: o.color };
  });
}

const TOOLS: { k: Tool; label: string; icon: ReactNode }[] = [
  { k: 'auto', label: 'Auto', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 20 10-10M14 4v3M18.5 5.5l-2 2M20 10h-3M12 7l3 3" /></svg> },
  { k: 'rect', label: 'Rectangle', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="1.5" /></svg> },
  { k: 'free', label: 'Free shape', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17 8 6l7 3 4 8-9 2z" /><circle cx="5" cy="17" r="1.6" fill="currentColor" /></svg> },
];

export default function Detect() {
  const { dispatch, current } = useDemo();
  const { setObjects } = useDemoExtra();
  const [objs, setObjs] = useState<DetObj[]>(() => initial(current?.objects ?? []));
  const [auto] = useState(() => flow.autoDetect);
  const [phase, setPhase] = useState<'running' | 'ready'>(auto ? 'running' : 'ready');
  const [runKey, setRunKey] = useState(0);
  const [prog, setProg] = useState(auto ? 0 : 1);
  const [head, setHead] = useState(.40);
  const [sel, setSel] = useState<number | null>(() => (auto ? null : objs.some(o => o.id === 5) ? 5 : objs[0]?.id ?? null));
  const [mode, setMode] = useState<Mode>('pick');
  const [tool, setTool] = useState<Tool>('auto');
  const [status, setStatus] = useState<ReactNode>(null);
  const [confirming, setConfirming] = useState(false);
  const [scan, setScan] = useState<{ key: number; word: string } | null>(null);
  const [hover, setHover] = useState<{ obj: number | null; region: RegionId | null }>({ obj: null, region: null });
  const [draft, setDraft] = useState<number[]>([]); // Free shape points so far (scene units)
  const [closing, setClosing] = useState<{ k: number; pts: number[] } | null>(null);
  const stopBtn = useRef<HTMLButtonElement>(null);
  const objsRef = useRef(objs), confirmRef = useRef(false), focusGo = useRef(false);
  useEffect(() => { objsRef.current = objs; }, [objs]);
  useEffect(() => { confirmRef.current = confirming; }, [confirming]);
  const [dots, setDots] = useState<{ k: number; x: number; y: number; add: boolean }[]>([]);
  const undoRef = useRef<(() => void) | null>(null);
  const notYet = useRef<DetObj[]>([]); // objects a Stop came too early for; Detect again looks for them again
  const nextId = useRef(Math.max(5, ...objs.map(o => o.id)) + 1);
  const frame = useRef<HTMLDivElement>(null);
  const lanesBox = useRef<HTMLDivElement>(null);
  const liveRect = useRef<SVGRectElement>(null), liveLine = useRef<SVGLineElement>(null);
  const drag = useRef<{ id: number; x0: number; y0: number; cx: number; cy: number; moved: boolean; touch: boolean } | null>(null);
  const draftRef = useRef<number[]>([]);
  const scanTimer = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach(id => window.clearTimeout(id)); window.clearTimeout(scanTimer.current); }, []);
  const running = phase === 'running';
  const t = running ? Math.min(.999, prog) : head;
  const drawing = mode === 'add' && tool !== 'auto';

  useEffect(() => { flow.autoDetect = false; }, []);

  const finish = useCallback((done: boolean) => {
    const list = objsRef.current, part = list.find(o => o.partial);
    setPhase('ready'); setProg(1); setHead(.40); setMode('pick'); setConfirming(false);
    // finishing while "Stop detecting?" is open removes the focused button: hand focus to Continue, as Stop does
    if (confirmRef.current) focusGo.current = true;
    setSel((part ?? list[0])?.id ?? null);
    setStatus(done
      ? <span>Found {list.length === 1 ? '1 object' : list.length + ' objects'}.{part ? ` ${part.name} was only partly found, so check its gaps before you continue.` : ''}</span>
      : <span>Stopped. Showing what was found so far.</span>);
  }, []);

  // detection progress, in place (rAF; state is set from the frame callback)
  useEffect(() => {
    if (phase !== 'running') return;
    const t0 = performance.now();
    let raf = 0;
    let painted = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / RUN_MS);
      if (p >= 1) { finish(true); return; }
      if (now - painted >= 50) { painted = now; setProg(p); } // about 20 updates a second is enough for the bar
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, runKey, finish]);

  const say = (node: ReactNode) => setStatus(node);
  const undoLink = (fn: () => void) => {
    undoRef.current = fn;
    return <button className="lnk" type="button" onClick={() => { const f = undoRef.current; undoRef.current = null; setStatus(null); f?.(); }}>Undo</button>;
  };
  const clearDraft = useCallback(() => { draftRef.current = []; setDraft([]); drag.current = null; }, []);
  // switching tools or modes drops a half-drawn shape
  const chooseMode = (m: Mode) => { if (m !== mode) clearDraft(); setMode(m); };
  const chooseTool = (k: Tool) => { if (k !== tool) clearDraft(); setTool(k); };

  /* ---------- add by name: a short detection over the frame ---------- */
  const endScan = (keep: boolean) => {
    window.clearTimeout(scanTimer.current);
    setScan(null);
    setObjs(list => (keep ? list.map(o => (o.pending ? { ...o, pending: false, fresh: false } : o)) : list.filter(o => !o.pending)));
  };
  const cancelScan = (word: string) => { endScan(false); say(<span>Stopped looking for {word}. Nothing was added.</span>); };

  const run = () => {
    if (scan) endScan(false);
    clearDraft();
    // nothing left to look for (every object removed): start again from the clip's objects
    if (objs.length === 0 && !notYet.current.length) setObjs(initial(current?.objects.length ? current.objects : makeObjects([null, null, null, null, null])));
    else if (notYet.current.length) { const back = notYet.current; setObjs(list => [...list, ...back].sort((a, b) => a.id - b.id)); }
    notYet.current = [];
    setPhase('running'); setRunKey(k => k + 1); setProg(0); setSel(null); setStatus(null); setMode('pick');
  };
  // Stop detecting asks first (R8), like Render's Cancel: Escape or "Keep detecting" carries on (StopConfirm)
  const askStop = () => setConfirming(true);
  const keep = useCallback(() => { setConfirming(false); requestAnimationFrame(() => stopBtn.current?.focus()); }, []);
  // Stop keeps only what was found so far (the "Found so far" chips), as its status says
  const stop = () => {
    const kept = objs.filter(o => prog >= firstSeen(o));
    notYet.current = objs.filter(o => !kept.includes(o));
    objsRef.current = kept; setObjs(kept);
    focusGo.current = true; finish(false);
  };
  // after the ready view is committed (no longer inert), focus Continue if Stop or a finish-during-confirm asked for it
  useEffect(() => {
    if (phase !== 'ready' || !focusGo.current) return;
    // the ready view fades in (visibility transition), so it may not take focus on the first try: retry for up to
    // ~0.5 s. The request is cleared only once it lands (or gives up), so an effect re-run (StrictMode) retries too.
    let id = 0, tries = 0;
    const tryFocus = () => {
      const g = document.getElementById('goBtn');
      g?.focus({ preventScroll: true });
      if (document.activeElement === g || ++tries > 8) { focusGo.current = false; return; }
      id = window.setTimeout(tryFocus, 60);
    };
    tryFocus();
    return () => window.clearTimeout(id);
  }, [phase]);

  const toLanesEnd = () => requestAnimationFrame(() => { const l = lanesBox.current?.querySelector('.lanes'); if (l) l.scrollTop = l.scrollHeight; });
  const remove = (id: number) => {
    const i = objs.findIndex(o => o.id === id);
    if (i < 0) return;
    const o = objs[i];
    setObjs(objs.filter(x => x.id !== id));
    if (sel === id) setSel(null);
    say(<span>Removed {o.name}. It stays grey. {undoLink(() => {
      setObjs(list => (list.some(x => x.id === o.id) ? list : (() => { const l = [...list]; l.splice(i, 0, o); return l; })()));
      setSel(o.id);
    })}</span>);
  };
  const jumpGap = useCallback((id: number, g: Gap) => { clearDraft(); setSel(id); setHead(g[0] + Math.min(.01, (g[1] - g[0]) / 2)); setMode('add'); }, [clearDraft]);
  const rename = (id: number, name: string) => setObjs(list => list.map(o => (o.id === id ? { ...o, name: [...name.trim()].slice(0, LIMITS.label).join('') || o.name } : o)));
  const FULL = <span>You can keep up to {LIMITS.objects} objects. Remove one to add another.</span>;

  const dot = (x: number, y: number, add: boolean) => {
    const k = Date.now() + Math.random();
    setDots(d => [...d, { k, x, y, add }]);
    timers.current.push(window.setTimeout(() => setDots(d => d.filter(q => q.k !== k)), 1900));
  };

  /* ---------- the frame tools ---------- */
  /** + Add area on an object that is already marked: fill its gap at this frame, or the part it was missing. */
  const fixObject = (o: DetObj) => {
    setSel(o.id);
    const g = inGap(o, head);
    if (g) {
      const next = { ...o, gaps: o.gaps.filter(x => x !== g) };
      setObjs(list => list.map(x => (x.id === o.id ? next : x)));
      say(<span>Added {o.name} back from {fmt(g[0] * DUR)} to {fmt(g[1] * DUR)}. Now found in {pct(next)}% of frames.</span>);
    } else if (o.partial) {
      setObjs(list => list.map(x => (x.id === o.id ? { ...x, partial: 0 } : x)));
      say(<span>Added the rest of {o.name}. The fix carries through the clip.</span>);
    } else say(<span>{o.name} is already found on this frame, edges and all.</span>);
  };
  /** Mark a region of the scene as a new object (or reach the object that already marks it). */
  const addRegion = (r: Region, how: 'click' | 'snap') => {
    const have = objs.find(o => o.shape.kind === 'region' && o.shape.id === r.id);
    if (have) {
      if (mode === 'add') { fixObject(have); return; }
      setSel(have.id); say(<span>{have.name} is already marked, so it’s selected.</span>); return;
    }
    if (objs.length >= LIMITS.objects) { say(FULL); return; }
    const id = nextId.current++;
    // marked on this frame, so it is found here even where the clip's tracking would have lost it
    const gaps = r.gaps.filter(g => !(head >= g[0] && head < g[1])).map(g => [...g] as Gap);
    setObjs(list => [...list, { id, name: r.label, box: [...r.box] as Box, shape: { kind: 'region', id: r.id }, gaps, color: null, fresh: true }]);
    setSel(id);
    say(<span>Added {r.label}. {how === 'snap' ? 'Your shape snapped to its edges.' : 'MoodPlay found its edges.'} {undoLink(() => setObjs(list => list.filter(o => o.id !== id)))}</span>);
    toLanesEnd();
  };
  const addCustom = (pts: number[]) => {
    if (objs.length >= LIMITS.objects) { say(FULL); return; }
    const used = new Set(objs.map(o => o.name));
    let k = 1;
    while (used.has('Area ' + k)) k++;
    const id = nextId.current++, shape: Shape = { kind: 'poly', pts }, name = 'Area ' + k;
    setObjs(list => [...list, { id, name, box: shapeBox(shape), shape, gaps: [], color: null, fresh: true }]);
    setSel(id);
    say(<span>Added {name} with the shape you drew. Rename it so you can find it later. {undoLink(() => setObjs(list => list.filter(o => o.id !== id)))}</span>);
    toLanesEnd();
  };
  /** A drawn rectangle or free shape: snap to the thing it mostly covers, or keep it as drawn. */
  const finishShape = (raw: number[]) => {
    const pts = boundPoly(raw);
    const m = pts ? maskOf({ kind: 'poly', pts }) : null;
    if (!pts || !m || areaOf(m) < 3) { say(<span>That shape is too small to mark. Draw a larger one.</span>); return; }
    const best = snapRegion(m);
    if (best && best.score >= SNAP) addRegion(best.region, 'snap');
    else addCustom(pts);
  };
  /** − Remove area: take the selected object out of the frames around the playhead (one second). */
  const removeAtHead = (o: DetObj) => {
    const a = Math.max(0, head - 1 / 24), b = Math.min(1, head + 1 / 24);
    let lo = a, hi = b;
    const rest = o.gaps.filter(g => { if (g[1] < a || g[0] > b) return true; lo = Math.min(lo, g[0]); hi = Math.max(hi, g[1]); return false; });
    const next = { ...o, gaps: [...rest, [lo, hi] as Gap].sort((x, y) => x[0] - y[0]) };
    setObjs(list => list.map(x => (x.id === o.id ? next : x)));
    say(<span>Removed {o.name} from {fmt(lo * DUR)} to {fmt(hi * DUR)}. Its lane shows the gap.</span>);
  };
  const background = (r: Region | null) => say(<span>{r ? `That’s the ${r.label.toLowerCase()}, which stays in the background.` : 'Nothing to mark there.'} To mark part of it, choose + Add area, then Rectangle or Free shape.</span>);

  /** A click or tap on the frame at scene point (x, y); px/py = frame pixels, for the feedback dot. */
  const tapAt = (x: number, y: number, px: number, py: number) => {
    const selObj = objs.find(o => o.id === sel) ?? null;
    if (mode === 'sub') {
      if (!selObj) return;
      if (inShape(selObj.shape, x, y)) { dot(px, py, false); removeAtHead(selObj); return; }
      const other = hitObject(objs, x, y);
      say(<span>{other ? `That’s ${other.name}, not ${selObj.name}. Select ${other.name} first to remove it here.` : `That isn’t part of ${selObj.name}, so nothing changed.`}</span>);
      return;
    }
    const o = hitObject(objs, x, y);
    if (o) {
      if (mode === 'add') { dot(px, py, true); fixObject(o); } else setSel(o.id);
      return;
    }
    const r = hitRegion(x, y);
    if (r?.detectable) addRegion(r, 'click');
    else background(r);
  };

  const toScene = (e: { clientX: number; clientY: number }) => {
    const r = frame.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 2100, y: ((e.clientY - r.top) / r.height) * 900, px: e.clientX - r.left, py: e.clientY - r.top, ppu: r.width / 2100 };
  };
  const ringPx = (touch: boolean) => (touch ? 22 : 14); // the closing target: at least 28 px across, larger for fingers
  const closeDraft = () => {
    const pts = draftRef.current;
    if (pts.length < 6) return;
    const k = Date.now();
    setClosing({ k, pts });
    timers.current.push(window.setTimeout(() => setClosing(c => (c?.k === k ? null : c)), 240));
    clearDraft();
    finishShape(pts);
  };
  const pushPoint = (x: number, y: number) => { draftRef.current = [...draftRef.current, Math.round(x), Math.round(y)]; setDraft(draftRef.current); };
  const busy = running || !!scan;

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (busy || !e.isPrimary || e.button !== 0 || (e.target as Element).closest('.tools, .shapes')) return;
    if (drag.current) return; // a second finger while drawing is ignored
    const p = toScene(e);
    drag.current = { id: e.pointerId, x0: p.x, y0: p.y, cx: e.clientX, cy: e.clientY, moved: false, touch: e.pointerType === 'touch' };
    if (drawing) { e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); }
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (busy) return;
    const p = toScene(e), d = drag.current;
    if (d && d.id === e.pointerId && !d.moved && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) > 6) d.moved = true;
    // track phase: the live rectangle and the line to the pointer follow 1:1, written straight to the SVG (no re-render)
    if (mode === 'add' && tool === 'rect' && d?.moved && liveRect.current) {
      const r = liveRect.current;
      r.setAttribute('x', String(Math.min(d.x0, p.x))); r.setAttribute('y', String(Math.min(d.y0, p.y)));
      r.setAttribute('width', String(Math.abs(p.x - d.x0))); r.setAttribute('height', String(Math.abs(p.y - d.y0)));
      r.style.display = '';
    }
    if (mode === 'add' && tool === 'free') {
      const pts = draftRef.current;
      if (liveLine.current && pts.length) {
        liveLine.current.setAttribute('x2', String(p.x)); liveLine.current.setAttribute('y2', String(p.y));
        liveLine.current.style.display = '';
      }
      // pressing and dragging traces the edge: a point every ~24 scene units along the way
      if (d?.moved && d.id === e.pointerId) {
        const lx = pts.length ? pts[pts.length - 2] : d.x0, ly = pts.length ? pts[pts.length - 1] : d.y0;
        if (!pts.length) pushPoint(d.x0, d.y0);
        else if (Math.hypot(p.x - lx, p.y - ly) > 24 && pts.length < 4 * LIMITS.points) pushPoint(p.x, p.y);
      }
    }
    // hover (mouse and pen): the object under the pointer, or the unmarked thing a click would add
    if (!drawing && e.pointerType !== 'touch') {
      const o = hitObject(objs, p.x, p.y);
      const r = o || mode === 'sub' ? null : hitRegion(p.x, p.y);
      const next = { obj: o?.id ?? null, region: r?.detectable ? r.id : null };
      if (next.obj !== hover.obj || next.region !== hover.region) setHover(next);
    }
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (busy) return;
    const p = toScene(e);
    if (mode === 'add' && tool === 'rect') {
      if (liveRect.current) liveRect.current.style.display = 'none';
      if (!d.moved) { say(<span>Drag across the frame to draw a rectangle.</span>); return; }
      const x0 = Math.min(d.x0, p.x), y0 = Math.min(d.y0, p.y), x1 = Math.max(d.x0, p.x), y1 = Math.max(d.y0, p.y);
      finishShape([x0, y0, x1, y0, x1, y1, x0, y1]);
      return;
    }
    if (mode === 'add' && tool === 'free') {
      const pts = draftRef.current;
      // releasing on the first point closes the shape (it needs at least three points)
      if (pts.length >= 6 && Math.hypot(p.x - pts[0], p.y - pts[1]) * p.ppu <= ringPx(d.touch)) { closeDraft(); return; }
      if (!d.moved || Math.hypot(p.x - pts[pts.length - 2], p.y - pts[pts.length - 1]) > 4) pushPoint(p.x, p.y);
      return;
    }
    if (d.moved) return; // a drag in Select or Auto is not a click
    tapAt(p.x, p.y, p.px, p.py);
  };
  const onCancel = () => { drag.current = null; if (liveRect.current) liveRect.current.style.display = 'none'; };
  const onLeave = () => { if (hover.obj != null || hover.region != null) setHover({ obj: null, region: null }); if (liveLine.current) liveLine.current.style.display = 'none'; };


  /** Keyboard on an object's outline button (pointer clicks go to the frame): the current tool on that object. */
  const keyObject = (o: DetObj) => {
    if (mode === 'pick') setSel(o.id);
    else if (mode === 'add') fixObject(o);
    else { setSel(o.id); removeAtHead(o); }
  };

  /* ---------- add by name ---------- */
  const addByName = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (scan || running) return;
    const input = e.currentTarget.elements.namedItem('addIn') as HTMLInputElement;
    const v = input.value.trim();
    if (!v) return;
    const word = [...v].slice(0, 60).join(''); // echoed in the status; objects take the found region's own name
    const found = findRegions(v);
    const marked = found.map(r => objs.find(o => o.shape.kind === 'region' && o.shape.id === r.id)).filter((o): o is DetObj => !!o);
    const fresh = found.filter(r => !objs.some(o => o.shape.kind === 'region' && o.shape.id === r.id));
    // nothing new to find, but the name is already on the list (an area you drew, an object you renamed): select it
    const named = fresh.length ? [] : objs.filter(o => !o.pending && norm(o.name) === norm(v));
    if (named.length) {
      setSel(named[0].id); input.value = '';
      say(<span>{named.length === 1 ? `${named[0].name} is already marked, so it’s selected.` : `${named.length} objects are called ${named[0].name}. The first one is selected.`}</span>);
      return;
    }
    if (found.length && !fresh.length) {
      setSel(marked[0].id);
      say(<span>{marked.length === 1 ? `${marked[0].name} is already marked, so it’s selected.` : `${listNames(marked.map(o => o.name))} are already marked. ${marked[0].name} is selected.`}</span>);
      return;
    }
    const room = LIMITS.objects - objs.length;
    if (fresh.length && room <= 0) { say(FULL); return; }
    const adding = fresh.slice(0, room);
    const added: DetObj[] = adding.map(r => ({ id: nextId.current++, name: r.label, box: [...r.box] as Box, shape: { kind: 'region', id: r.id }, gaps: r.gaps.map(g => [...g] as Gap), color: null, pending: true }));
    input.value = '';
    const report = () => {
      if (!added.length) { say(<span>No {word} found in this clip. Try another name or add the area yourself.</span>); return; }
      const kind = adding[0].kind, noun = KIND_NOUN[kind][added.length === 1 ? 0 : 1];
      const ids = added.map(o => o.id);
      setSel(ids[0]); toLanesEnd();
      say(<span>
        {added.length === 1 ? `Found ${added[0].name}.` : `Found ${wordLower(added.length)} ${noun}: ${listNames(added.map(o => o.name))}.`}
        {marked.length ? ` ${listNames(marked.map(o => o.name))} ${marked.length === 1 ? 'was' : 'were'} already marked.` : ''}
        {adding.length < fresh.length ? ` ${fresh.length - adding.length} more didn’t fit: you can keep up to ${LIMITS.objects} objects.` : ''}
        {' '}{undoLink(() => setObjs(list => list.filter(o => !ids.includes(o.id))))}
      </span>);
    };
    if (prefersReducedMotion()) { // no scan to watch: the result is there at once
      setObjs(list => [...list, ...added.map(o => ({ ...o, pending: false }))]);
      report();
      return;
    }
    const key = Date.now();
    setObjs(list => [...list, ...added]);
    if (added.length) { setSel(added[0].id); toLanesEnd(); }
    setScan({ key, word });
    say(<span>Looking for {word} in every frame… <button className="lnk" type="button" onClick={() => cancelScan(word)}>Cancel</button></span>);
    window.clearTimeout(scanTimer.current);
    scanTimer.current = window.setTimeout(() => { endScan(true); report(); }, SCAN_MS);
  };

  // keys: Escape drops a half-drawn shape (or leaves + / −), Enter closes a free shape, Backspace removes its last point
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keys.current = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const drafting = draftRef.current.length > 0;
      if (e.key === 'Escape') { if (drafting) { e.preventDefault(); clearDraft(); } else setMode(m => (m !== 'pick' ? 'pick' : m)); }
      else if (e.key === 'Enter' && drafting && !onControl(e.target) && mode === 'add' && tool === 'free' && draftRef.current.length >= 6) { e.preventDefault(); closeDraft(); }
      else if (e.key === 'Backspace' && drafting) { e.preventDefault(); draftRef.current = draftRef.current.slice(0, -2); setDraft(draftRef.current); }
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // leaving Detect any other way (step rail, Home, Back) keeps what was marked, as Continue does; only real
  // changes are saved (so a visit that changes nothing doesn't move the project up the list), never mid-detection
  const leave = useRef({ ready: !auto, saved: current?.objects ?? [], save: setObjects });
  useEffect(() => { leave.current.ready = phase === 'ready'; leave.current.save = setObjects; }, [phase, setObjects]);
  useEffect(() => () => {
    const l = leave.current, next = toSceneObjects(objsRef.current);
    if (l.ready && JSON.stringify(next) !== JSON.stringify(l.saved.map(o => ({ id: o.id, label: o.label, color: o.color, box: o.box, shape: o.shape })))) l.save(next);
  }, []);
  const toColorize = () => {
    const next = toSceneObjects(objs);
    leave.current.saved = next;
    setObjects(next);
    if (current && current.step < 3) dispatch({ type: 'setStep', step: 3 });
    go('colorize');
  };

  const onToolKey = (e: RKeyboardEvent<HTMLButtonElement>) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = (TOOLS.findIndex(x => x.k === tool) + d + TOOLS.length) % TOOLS.length;
    chooseTool(TOOLS[i].k);
    (e.currentTarget.parentElement?.children[i] as HTMLElement | undefined)?.focus();
  };

  const selObj = objs.find(o => o.id === sel) ?? null;
  // phones and tablets tap, mice click: the one hint shown on a phone says the right verb
  const coarse = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const hint = (() => {
    if (mode === 'add' && tool === 'rect') return 'Drag a box around the area. It snaps to the edges of what it mostly covers';
    if (mode === 'add' && tool === 'free') return draft.length >= 6 ? (coarse ? 'Tap the first point to close the shape' : 'Click the first point or press Enter to close the shape') : `${coarse ? 'Tap' : 'Click'} around its edges, point by point. ${coarse ? 'Tap' : 'Click'} the first point to close`;
    if (mode === 'add') return selObj && inGap(selObj, head) ? `Click ${selObj.name} on the frame to add it back here` : 'Click an object. MoodPlay finds its edges and adds it';
    if (mode === 'sub') return selObj ? `Click ${selObj.name} to remove it from this frame` : 'Select an object first';
    if (!selObj) return 'Click an object to select it, or click something unmarked to add it';
    if (selObj.partial && !inGap(selObj, head)) return `${selObj.name} is partly found. Choose + Add area, then click the missing part`;
    if (inGap(selObj, head)) return `${selObj.name} isn’t found on this frame. Choose + Add area, then click it`;
    return 'Click an object to select it. + Add area marks more, − Remove area takes the selected one out of this frame';
  })();
  const p100 = Math.round(prog * 100), f = Math.min(FRAMES, Math.floor(prog * FRAMES) + 1), left = Math.ceil((1 - prog) * 70);
  const seen = (o: DetObj) => !running || prog >= firstSeen(o);
  const cand = hover.region && !drawing ? REGION[hover.region] : null;

  /* one outline per object: the region's exact shape, minus whatever stands in front of it */
  const outline = (o: DetObj) => {
    const found = !inGap(o, t) && seen(o), isSel = o.id === sel, d = shapePath(o.shape), r = regionOf(o);
    const cls = 'oshape' + (isSel ? ' sel' : '') + (found ? '' : ' gone') + (hover.obj === o.id && !isSel ? ' hov' : '') + (o.fresh ? ' fresh' : '');
    const body = (clip?: string) => (
      <g clipPath={clip}>
        <path className="tint" d={d} /><path className="under" d={d} /><path className="edge" d={d} />
      </g>
    );
    return (
      <g key={o.id} className={cls} mask={r ? maskFor(r.id) : undefined}>
        {o.partial ? <>
          {body(`url(#dp-${o.id}-a)`)}
          <g clipPath={`url(#dp-${o.id}-b)`} className="miss"><path d={d} /></g>
        </> : body()}
      </g>
    );
  };
  const partialDefs = objs.filter(o => o.partial).map(o => {
    const y = shapeBox(o.shape)[1] + (o.partial ?? 0);
    return [
      <clipPath key={o.id + 'a'} id={`dp-${o.id}-a`}><rect x="0" y="0" width="2100" height={y} /></clipPath>,
      <clipPath key={o.id + 'b'} id={`dp-${o.id}-b`}><rect x="0" y={y} width="2100" height={900 - y} /></clipPath>,
    ];
  });
  const settled = objs.filter(o => !o.pending), pendingObjs = objs.filter(o => o.pending);
  const start = draft.length ? { x: draft[0], y: draft[1] } : null;

  return (
    <>
      <TopBar kind="step" step={2} reached={reachedFor(current, 2)} />
      <main className="sp sp-detect" data-state={running ? 'running' : 'ready'} style={{ '--scan': SCAN_MS + 'ms' } as CSSProperties}>
        <section className="sp-stage" aria-label="Frame and tracking">
          <div className="viewer dviewer" data-tour="tut_frame_tools">
            <div ref={frame} className={'dframe' + (drawing ? ' drawing' : '') + (cand || hover.obj != null ? ' over' : '')} id="frame"
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} onPointerLeave={onLeave}>
              <Scene variant="gray" videoSrc={current?.videoSrc} />
              <svg className="oshapes" viewBox="0 0 2100 900" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <defs><FrontMasks prefix="dm" />{partialDefs}
                  <pattern id="dhatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="5" height="14" fill="rgba(200,50,107,.45)" /></pattern>
                </defs>
                {cand ? <g className="cand" mask={maskFor(cand.id)}><path d={cand.d} /></g> : null}
                {settled.map(outline)}
                {closing ? <polygon key={closing.k} className="closing" points={closing.pts.join(' ')} /> : null}
                {draft.length ? <>
                  <polyline className="draft" points={draft.join(' ')} />
                  <line ref={liveLine} className="draft live" x1={draft[draft.length - 2]} y1={draft[draft.length - 1]} x2={draft[draft.length - 2]} y2={draft[draft.length - 1]} />
                </> : null}
                <rect ref={liveRect} className="draft box" style={{ display: 'none' }} />
              </svg>
              {scan ? <>
                <svg key={scan.key} className="oshapes scanning" viewBox="0 0 2100 900" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                  {pendingObjs.map(outline)}
                </svg>
                <div className="sweepbox" aria-hidden="true"><div key={scan.key} className="sweep" /></div>
              </> : null}
              <div className="overlay">
                {objs.map(o => {
                  const found = !inGap(o, t) && seen(o) && !o.pending, b = shapeBox(o.shape), h = o.partial || b[3] - b[1], isSel = o.id === sel;
                  return (
                    <button key={o.id} type="button" tabIndex={running || o.pending ? -1 : 0}
                      className={'obox' + (isSel ? ' sel' : '') + (found ? '' : ' gone')}
                      style={{ left: P(b[0], 2100), top: P(b[1], 900), width: P(b[2] - b[0], 2100), height: P(h, 900) }}
                      aria-label={o.name + (o.partial ? ', partly found' : '') + (isSel ? ', selected' : '')}
                      onClick={() => keyObject(o)}>
                      <span className={'obj' + (isSel ? ' sel' : '')} style={badgeAt(b)}>{o.id}</span>
                      {/* the tag reads to the badge's right, or to its left when the object sits in the frame's right half */}
                      {o.partial ? <span className={'tag' + (b[0] > 1050 ? ' l' : '')}>Partly found</span> : null}
                    </button>
                  );
                })}
              </div>
              {start ? <span className={'ring' + (draft.length >= 6 ? ' ready' : '')} style={{ left: P(start.x, 2100), top: P(start.y, 900) }} aria-hidden="true" /> : null}
              {dots.map(d => <span key={d.k} className={'ddot ' + (d.add ? 'add' : 'sub')} style={{ left: d.x, top: d.y }} aria-hidden="true">{d.add ? '+' : '−'}</span>)}
              <div className="scanline" aria-hidden="true" />
              <span className="chip runtag">Frame {n(f)} of {n(FRAMES)}</span>
              <div className="tools" role="toolbar" aria-label="Frame tools">
                <button type="button" aria-pressed={mode === 'pick'} onClick={() => chooseMode('pick')} aria-label="Select or add">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3l14 8-6 2-2 6z" /></svg><span className="tt">Select or add</span></button>
                <button type="button" aria-pressed={mode === 'add'} onClick={() => chooseMode('add')} aria-label="Add area" title="Mark an area: Auto finds an object's edges, or draw a rectangle or a free shape"><span className="k" aria-hidden="true">+</span><span className="tt">Add area</span></button>
                <button type="button" aria-pressed={mode === 'sub'} disabled={!selObj} onClick={() => chooseMode('sub')} aria-label="Remove area" title="Click the selected object to remove it from this frame"><span className="k" aria-hidden="true">−</span><span className="tt">Remove area</span></button>
              </div>
              {mode === 'add' ? (
                <div className="shapes" role="radiogroup" aria-label="Area shape">
                  {TOOLS.map(x => (
                    <button key={x.k} type="button" role="radio" aria-checked={tool === x.k} tabIndex={tool === x.k ? 0 : -1} aria-label={x.label} title={x.label}
                      aria-describedby={x.k === 'free' ? 'freeNote' : undefined} onClick={() => chooseTool(x.k)} onKeyDown={onToolKey}>
                      {x.icon}<span className="tt">{x.label}</span>
                    </button>
                  ))}
                  <span id="freeNote" className="sr">Free shape needs a mouse, pen or touch. With a keyboard, use Auto on an object’s outline, or add an object by name.</span>
                </div>
              ) : null}
              <div className={'vhint' + (drawing ? ' drawhint' : '')} aria-live="polite">{hint}</div>
            </div>
          </div>

          <div className="timeline dtimeline" ref={lanesBox}>
            <ObjectLanes objs={objs} sel={sel} head={t} running={running} prog={prog} onScrub={setHead} onJump={jumpGap} />
          </div>
        </section>

        <aside className="sp-panel card" aria-label="Objects">
          <div className="views">
            <section className="v-ready" aria-label="Objects found" inert={running}>
              <div className="p-body">
                <div className="p-head"><div>
                  <h2>Objects<span className="count">{objs.length}</span></h2>
                  <p>Rename, remove or fix any object.</p>
                </div></div>
                <div role="status">{status && <div className="status">{status}</div>}</div>
                <ul className="olist">
                  {objs.map(o => {
                    const p = pct(o), low = p < 60, isSel = o.id === sel, b = shapeBox(o.shape);
                    const cx = (b[0] + b[2]) / 2, cy = (b[1] + (o.partial ? b[1] + o.partial : b[3])) / 2, s = Math.max(b[2] - b[0], b[3] - b[1]) * 1.15;
                    return (
                      <li key={o.id} className={'orow' + (isSel ? ' sel' : '')} onClick={e => { if (!(e.target as Element).closest('input,button')) setSel(o.id); }}>
                        <span className="obj">{o.id}</span>
                        <span className="crop" aria-hidden="true"><Scene variant="gray" viewBox={`${cx - s / 2} ${cy - s / 2} ${s} ${s}`} /></span>
                        <span style={{ minWidth: 0 }}>
                          <input className="oname" maxLength={LIMITS.label} defaultValue={o.name} aria-label={'Name of object ' + o.id} key={o.name}
                            onFocus={() => setSel(o.id)} onBlur={e => rename(o.id, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                          <span className={'found' + (low && !o.pending ? ' low' : '')}>
                            {o.pending ? 'Looking for it…' : <>Found in {p}% of frames{o.gaps.length > 0 && low && <>. <button className="lnk" type="button" onClick={e => { e.stopPropagation(); jumpGap(o.id, o.gaps[0]); }}>{o.gaps.length === 1 ? 'Check gap' : 'Check ' + o.gaps.length + ' gaps'}</button></>}</>}
                          </span>
                        </span>
                        <button className="rm" type="button" aria-label={'Remove ' + o.name} disabled={o.pending} onClick={e => { e.stopPropagation(); remove(o.id); }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <form className="addname" id="addForm" autoComplete="off" onSubmit={addByName} data-tour="tut_add_by_name">
                  <label htmlFor="addIn">Add an object by name</label>
                  <div className="addrow">
                    <input className="inp" id="addIn" name="addIn" maxLength={LIMITS.label} placeholder="For example: building, shop…" aria-describedby="addHelp" />
                    <button className="btn btn-line bsm" type="submit" aria-disabled={!!scan || undefined}>{scan ? 'Finding…' : 'Find'}</button>
                  </div>
                  <p className="help" id="addHelp">MoodPlay looks for it in every frame and marks each one it finds.</p>
                </form>
              </div>
              <div className="p-foot">
                <button className="btn btn-pink btn-lg" type="button" id="goBtn" onClick={toColorize} disabled={settled.length === 0} data-tour="btn_to_colorize">Continue to colorize</button>
                <p className="next">{objs.length === 0 && <>Add an object to continue, or </>}<button className="lnk quietlnk" type="button" onClick={run}>{objs.length === 0 ? 'detect again' : 'Detect again'}</button></p>
              </div>
            </section>

            <section className="v-run" aria-label="Detection running" inert={!running}>
              <div className="p-body">
                <div className="p-head"><div><h2>Finding objects</h2><p>You can watch it work on the frame and in the lanes.</p></div></div>
                <div className="prog">
                  <span className="sr" role="status">{running && p100 < 100 ? Math.floor(p100 / 25) * 25 + '% done' : ''}</span>
                  <div className="big">{p100}%</div>
                  <div className="bar"><i style={{ transform: `scaleX(${prog})` }} /></div>
                  <div className="sub">Frame {n(f)} of {n(FRAMES)}. {left > 59 ? 'About 1 minute left.' : 'About ' + Math.max(1, left) + ' seconds left.'}</div>
                </div>
                <ol className="dsteps">
                  <li className="done"><span className="ic">{CHECK}</span>Read the clip</li>
                  <li className={prog > .5 ? 'done' : 'now'}><span className="ic">{prog > .5 && CHECK}</span>Find people and objects</li>
                  <li className={prog > .5 ? 'now' : ''}><span className="ic" />Follow each one through the clip</li>
                </ol>
                <div>
                  <p className="help" style={{ marginBottom: 8 }}>Found so far</p>
                  <div className="soFar">
                    {running && objs.filter(o => prog >= firstSeen(o)).sort((a, b) => firstSeen(a) - firstSeen(b)).map(o => <span key={o.id} className="chip"><span className="obj">{o.id}</span>{o.name}</span>)}
                  </div>
                </div>
              </div>
              <div className="p-foot">
                {confirming ? (
                  <StopConfirm id="dcf-t" title="Stop detecting?" text="Objects found so far are kept. You can detect again any time."
                    keepLabel="Keep detecting" stopLabel="Stop" onKeep={keep} onStop={stop} />
                ) : (
                  <>
                    <button ref={stopBtn} className="btn btn-line btn-lg" type="button" onClick={askStop}>Stop detecting</button>
                    <p className="next">Next: check each object and fill any gaps</p>
                  </>
                )}
              </div>
            </section>
          </div>
        </aside>
      </main>
    </>
  );
}
