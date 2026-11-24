import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent as RMouseEvent, type ReactNode } from 'react';
import './steps.css';
import './detect.css';
import { TopBar } from '../chrome/TopBar';
import { IconCheck } from '../chrome/Icons';
import { Scene } from '../scene';
import { LIMITS, makeObjects, useDemo, useDemoExtra, type SceneObject } from '../store';
import { CLIP, clipTimeNear as fmt, num as n } from '../format';
import { go } from '../nav';
import { ObjectLanes, type Gap } from '../parts/ObjectLanes';
import { StopConfirm } from '../parts/StopConfirm';
import { flow, reachedFor } from '../parts/flow';

/* Detect (v5-detect.html): simulated detection with progress along the filmstrip and the frame outlined,
   then the object list (rename, remove + Undo, "Check gap"), object lanes with hatched gaps (click = jump),
   + / − area tools on the frame, click the frame to add an object, and add an object by name.
   "Stop detecting" asks first, like Render's Cancel (ruling R8). The clip is the shared sample clip (format.ts CLIP). */

type Box = [number, number, number, number];
interface DetObj { id: number; name: string; box: Box; gaps: Gap[]; partial?: number; pending?: boolean; color: SceneObject['color'] }
type Mode = 'pick' | 'add' | 'sub';

const DUR = CLIP.seconds, FRAMES = CLIP.frames, RUN_MS = 7000;
// where each sample object goes missing (fractions of the clip), from the mockup
const GAPS: Record<number, { gaps: Gap[]; partial?: number; top?: number }> = {
  1: { gaps: [[.62, .665]] }, 2: { gaps: [] }, 3: { gaps: [[0, .08]] }, 4: { gaps: [[.30, .37]] },
  5: { gaps: [[0, .20], [.45, .70], [.86, 1]], partial: 216, top: 424 },
};
const pct = (o: DetObj) => Math.round((1 - o.gaps.reduce((s, g) => s + g[1] - g[0], 0)) * 100);
const inGap = (o: DetObj, t: number) => o.gaps.find(g => t >= g[0] && t < g[1]);
const firstSeen = (o: DetObj) => { let t = 0; for (const g of [...o.gaps].sort((a, b) => a[0] - b[0])) { if (g[0] <= t + 1e-6) t = Math.max(t, g[1]); else break; } return t; };
const P = (v: number, of: number) => (v / of) * 100 + '%';
const CHECK = <IconCheck size={11} />;

function initial(objects: SceneObject[]): DetObj[] {
  return objects.map(o => {
    const d = GAPS[o.id];
    const box: Box = [o.box[0], d?.top ?? o.box[1], o.box[2], o.box[3]];
    return { id: o.id, name: o.label, box, gaps: d ? d.gaps.map(g => [...g] as Gap) : [[.55, .62]], partial: d?.partial, color: o.color };
  });
}

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
  const [status, setStatus] = useState<ReactNode>(null);
  const [confirming, setConfirming] = useState(false);
  const stopBtn = useRef<HTMLButtonElement>(null);
  const objsRef = useRef(objs), confirmRef = useRef(false), focusGo = useRef(false);
  useEffect(() => { objsRef.current = objs; }, [objs]);
  useEffect(() => { confirmRef.current = confirming; }, [confirming]);
  const [dots, setDots] = useState<{ k: number; x: number; y: number; add: boolean }[]>([]);
  const removed = useRef<{ o: DetObj; i: number } | null>(null);
  const notYet = useRef<DetObj[]>([]); // objects a Stop came too early for; Detect again looks for them again
  const nextId = useRef(Math.max(5, ...objs.map(o => o.id)) + 1);
  const frame = useRef<HTMLDivElement>(null);
  const lanesBox = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(id => window.clearTimeout(id)), []);
  const running = phase === 'running';
  const t = running ? Math.min(.999, prog) : head;

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

  const run = () => {
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

  const say = (node: ReactNode) => setStatus(node);
  const remove = (id: number) => {
    const i = objs.findIndex(o => o.id === id);
    if (i < 0) return;
    removed.current = { o: objs[i], i };
    setObjs(objs.filter(o => o.id !== id));
    if (sel === id) setSel(null);
    say(<span>Removed {objs[i].name}. It stays grey. <button className="lnk" type="button" onClick={undo}>Undo</button></span>);
  };
  function undo() {
    const r = removed.current;
    if (!r) return;
    setObjs(list => { const l = [...list]; l.splice(r.i, 0, r.o); return l; });
    setSel(r.o.id); removed.current = null; setStatus(null);
  }
  const jumpGap = useCallback((id: number, g: Gap) => { setSel(id); setHead(g[0] + Math.min(.01, (g[1] - g[0]) / 2)); setMode('add'); }, []);
  const rename = (id: number, name: string) => setObjs(list => list.map(o => (o.id === id ? { ...o, name: [...name.trim()].slice(0, LIMITS.label).join('') || o.name } : o)));
  const FULL = <span>You can keep up to {LIMITS.objects} objects. Remove one to add another.</span>;

  const dot = (e: RMouseEvent, add: boolean) => {
    const r = frame.current!.getBoundingClientRect(), k = Date.now() + Math.random();
    setDots(d => [...d, { k, x: e.clientX - r.left, y: e.clientY - r.top, add }]);
    timers.current.push(window.setTimeout(() => setDots(d => d.filter(x => x.k !== k)), 1900));
  };
  const fix = (e: RMouseEvent) => {
    const o = objs.find(x => x.id === sel);
    if (!o) return;
    if (mode === 'sub') { dot(e, false); say(<span>Removed that area from {o.name} in every frame.</span>); return; }
    dot(e, true);
    const g = inGap(o, head);
    if (g) {
      const next = { ...o, gaps: o.gaps.filter(x => x !== g) };
      setObjs(objs.map(x => (x.id === o.id ? next : x)));
      say(<span>Added {o.name} back from {fmt(g[0] * DUR)} to {fmt(g[1] * DUR)}. Now found in {pct(next)}% of frames.</span>);
    } else if (o.partial) {
      setObjs(objs.map(x => (x.id === o.id ? { ...x, partial: 0 } : x)));
      say(<span>Added the rest of {o.name}. The fix carries through the clip.</span>);
    } else say(<span>Added that area to {o.name} in every frame.</span>);
  };
  const onFrame = (e: RMouseEvent<HTMLDivElement>) => {
    if (running) return;
    if (mode !== 'pick') { fix(e); return; }
    if (objs.length >= LIMITS.objects) { say(FULL); return; }
    const r = frame.current!.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 2100, y = ((e.clientY - r.top) / r.height) * 900;
    const w = 170, h = 200, id = nextId.current++;
    const x0 = Math.max(0, Math.min(2100 - w, x - w / 2)), y0 = Math.max(0, Math.min(900 - h, y - h / 2));
    setObjs([...objs, { id, name: 'Object ' + id, box: [x0, y0, x0 + w, y0 + h], gaps: [[.55, .62]], color: null }]);
    setSel(id);
    say(<span>Added Object {id}. Give it a name so you can find it later.</span>);
    requestAnimationFrame(() => { const l = lanesBox.current?.querySelector('.lanes'); if (l) l.scrollTop = l.scrollHeight; });
  };
  const addByName = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem('addIn') as HTMLInputElement;
    const v = input.value.trim();
    if (!v) return;
    if (objs.length >= LIMITS.objects) { say(FULL); return; }
    // capitalise first, then clamp: some letters grow when capitalised (ß -> SS), and the stored-state check allows 200
    const [c0, ...rest] = [...v], nm = [...(c0.toUpperCase() + rest.join(''))].slice(0, LIMITS.label).join(''), id = nextId.current++;
    setObjs(list => [...list, { id, name: nm, box: [1180, 190, 1440, 550], gaps: [[.1, .24]], pending: true, color: null }]);
    input.value = ''; setSel(id);
    say(<span>Looking for {nm} in every frame…</span>);
    timers.current.push(window.setTimeout(() => {
      setObjs(list => list.map(o => (o.id === id ? { ...o, pending: false } : o)));
      say(<span>Found {nm} in 86% of frames.</span>);
    }, 1100));
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMode(m => (m !== 'pick' ? 'pick' : m)); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toColorize = () => {
    setObjects(objs.map(o => ({ id: o.id, label: o.name, color: o.color, box: o.id === 5 && GAPS[5].top ? [o.box[0], current?.objects.find(x => x.id === 5)?.box[1] ?? o.box[1], o.box[2], o.box[3]] : o.box })));
    if (current && current.step < 3) dispatch({ type: 'setStep', step: 3 });
    go('colorize');
  };

  const selObj = objs.find(o => o.id === sel) ?? null;
  const hint = !selObj ? 'Click anything on the frame to add it as an object'
    : mode === 'add' ? (inGap(selObj, head) ? `Click ${selObj.name} on the frame to add it back here` : `Click a part of ${selObj.name} that is missing from its outline`)
      : mode === 'sub' ? `Click an area that is not part of ${selObj.name}`
        : selObj.partial && !inGap(selObj, head) ? `${selObj.name} is partly found. Choose + Add area, then click the missing part`
          : inGap(selObj, head) ? `${selObj.name} isn’t found on this frame. Choose + Add area, then click it`
            : `Click anything on the frame to add it as an object. Use + and − to fix ${selObj.name}`;
  const p100 = Math.round(prog * 100), f = Math.min(FRAMES, Math.floor(prog * FRAMES) + 1), left = Math.ceil((1 - prog) * 70);
  const seen = (o: DetObj) => !running || prog >= firstSeen(o);

  return (
    <>
      <TopBar kind="step" step={2} reached={reachedFor(current, 2)} />
      <main className="sp sp-detect" data-state={running ? 'running' : 'ready'}>
        <section className="sp-stage" aria-label="Frame and tracking">
          <div className="viewer dviewer">
            <div ref={frame} className="dframe" id="frame" onClick={onFrame} data-tour="tut_frame_tools">
              <Scene variant="gray" videoSrc={current?.videoSrc} />
              <div className="overlay">
                {objs.map(o => {
                  const found = !inGap(o, t) && seen(o), h = o.partial || o.box[3] - o.box[1], isSel = o.id === sel;
                  return (
                    <button key={o.id} type="button" tabIndex={running ? -1 : 0}
                      className={'obox' + (isSel ? ' sel' : '') + (found ? '' : ' gone') + (o.partial ? ' partial' : '')}
                      style={{ left: P(o.box[0], 2100), top: P(o.box[1], 900), width: P(o.box[2] - o.box[0], 2100), height: P(h, 900), ...(o.partial ? { '--miss': ((o.box[3] - o.box[1] - o.partial) / h) * 100 + '%' } : {}) }}
                      aria-label={o.name + (o.partial ? ', partly found' : '') + (isSel ? ', selected' : '')}
                      onClick={e => { e.stopPropagation(); if (mode !== 'pick') fix(e); else setSel(o.id); }}>
                      <span className={'obj' + (isSel ? ' sel' : '')}>{o.id}</span>
                      {o.partial ? <span className="tag">Partly found</span> : null}
                    </button>
                  );
                })}
              </div>
              {dots.map(d => <span key={d.k} className={'ddot ' + (d.add ? 'add' : 'sub')} style={{ left: d.x, top: d.y }} aria-hidden="true">{d.add ? '+' : '−'}</span>)}
              <div className="scanline" aria-hidden="true" />
              <span className="chip runtag">Frame {n(f)} of {n(FRAMES)}</span>
              <div className="tools" role="toolbar" aria-label="Frame tools" onClick={e => e.stopPropagation()}>
                <button type="button" aria-pressed={mode === 'pick'} onClick={() => setMode('pick')} aria-label="Select or add">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3l14 8-6 2-2 6z" /></svg><span className="tt">Select or add</span></button>
                <button type="button" aria-pressed={mode === 'add'} disabled={!selObj} onClick={() => setMode('add')} aria-label="Add area" title="Click on the frame to add an area to the selected object"><span className="k" aria-hidden="true">+</span><span className="tt">Add area</span></button>
                <button type="button" aria-pressed={mode === 'sub'} disabled={!selObj} onClick={() => setMode('sub')} aria-label="Remove area" title="Click on the frame to remove an area from the selected object"><span className="k" aria-hidden="true">−</span><span className="tt">Remove area</span></button>
              </div>
              <div className="vhint" aria-live="polite">{hint}</div>
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
                    const p = pct(o), low = p < 60, isSel = o.id === sel;
                    const cx = (o.box[0] + o.box[2]) / 2, cy = (o.box[1] + (o.partial ? o.box[1] + o.partial : o.box[3])) / 2, s = Math.max(o.box[2] - o.box[0], o.box[3] - o.box[1]) * 1.15;
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
                        <button className="rm" type="button" aria-label={'Remove ' + o.name} onClick={e => { e.stopPropagation(); remove(o.id); }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <form className="addname" id="addForm" autoComplete="off" onSubmit={addByName} data-tour="tut_add_by_name">
                  <label htmlFor="addIn">Add an object by name</label>
                  <div className="addrow">
                    <input className="inp" id="addIn" name="addIn" maxLength={LIMITS.label} placeholder="For example: lamp post, dog" />
                    <button className="btn btn-line bsm" type="submit">Find</button>
                  </div>
                  <p className="help">MoodPlay looks for it in every frame.</p>
                </form>
              </div>
              <div className="p-foot">
                <button className="btn btn-pink btn-lg" type="button" id="goBtn" onClick={toColorize} disabled={objs.length === 0} data-tour="btn_to_colorize">Continue to colorize</button>
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
