import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import './steps.css';
import './render.css';
import { TopBar } from '../chrome/TopBar';
import { IconCheck } from '../chrome/Icons';
import { Scene } from '../scene';
import { coloredCount, useDemo, type MoodKey, type SceneObject } from '../store';
import { TOUR_FIRST, demoHref, go } from '../nav';
import { CLIP_PHRASE, MOOD_LABEL, realMood } from '../format';
import { EmptyStep } from '../parts/EmptyStep';
import { StopConfirm } from '../parts/StopConfirm';
import { RENDER_FRAMES as FRAMES, renderEstimate } from '../parts/estimate';

/* Render (v5-render.html): a simulated render that mirrors pages/results.py. Stage 1 colours the objects,
   stage 2 applies the mood (skipped when there is no mood). It replays the mockup's 3m 52s run in about 12 s,
   but every number on the page is the real-run copy: overall %, stage rows with the live message, elapsed,
   time left (estimated from earlier runs, then corrected from this run's speed), frames, the latest frame.
   Cancel asks first. When it finishes: "Completed in …", and Results open by themselves after 5 seconds.
   While the tour runs, the render is frozen mid-run (tutorial-v5.md: 96 s into the run), so the auto-open of
   Results never pulls the tour away; it carries on from there when the tour is paused or ends. */

const DEMO_SECONDS = 12;
const TOUR_FREEZE_S = 96; // the mockup's v5-render.html?t=96&freeze
const fmt = (s: number) => { s = Math.round(s); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's'; };
const about = (s: number) => (s < 5 ? 'Under 5s' : fmt(Math.round(s / 5) * 5));
const CHECK = <IconCheck />;

interface Tick { st: number; ip: number; p: number; msg: string; done: number }

function makeRun(stages: number[], moodName: string | null) {
  const total = stages.reduce((a, b) => a + b, 0), n = stages.length;
  const starts = stages.map((_, i) => stages.slice(0, i).reduce((a, b) => a + b, 0));
  // progress weights from pages/results.py: colours 0-60 %, mood 60-100 % (colours only: 0-100 %)
  const w0 = n === 2 ? .6 : 1;
  const at = (t: number): Tick => {
    const st = n === 2 && t >= stages[0] ? 2 : 1;
    const u = Math.min(1, (t - starts[st - 1]) / stages[st - 1]);
    let ip: number, msg: string, done: number;
    // inner phases follow src/diffusion/sd_runner.py progress callbacks
    if (u < .04) { ip = (u / .04) * .10; done = 0; msg = st === 1 ? 'Building colour prompts from selections…' : `Applying ‘${moodName}’ mood grade to ${FRAMES} frames…`; }
    else if (u < .88) { const k = (u - .04) / .84; done = Math.floor(k * FRAMES); ip = .10 + k * .78; msg = st === 1 ? `Colorizing frame ${done + 1}/${FRAMES}…` : `Grading frame ${done + 1}/${FRAMES} [${moodName}]…`; }
    else if (u < .94) { ip = .90; done = FRAMES; msg = 'Applying temporal chroma stabilisation…'; }
    else { ip = .92 + ((u - .94) / .06) * .08; done = FRAMES; msg = st === 1 ? 'Assembling output video…' : 'Assembling styled video…'; }
    const p = st === 1 ? ip * w0 : .6 + ip * .4;
    return { st, ip, p: Math.min(1, p), msg, done };
  };
  // live estimate per stage: expected length blended with the rate observed so far (weight grows from 10 % to 50 % progress)
  const remaining = (t: number, r: Tick) => {
    const ts = t - starts[r.st - 1], exp = stages[r.st - 1];
    const w = Math.min(1, Math.max(0, (r.ip - .10) / .40));
    const observed = r.ip > 0 ? ts / r.ip : exp;
    const curLen = (1 - w) * exp + w * observed, speed = curLen / exp;
    const later = stages.slice(r.st).reduce((a, b) => a + b * ((1 - w) + w * speed), 0);
    return Math.max(0, curLen - ts) + later;
  };
  return { total, at, remaining, stages: n };
}

type Phase = 'run' | 'done' | 'stopped';

export default function RenderScreen() {
  const { state, dispatch, current } = useDemo();
  const frozen = !!state.tour?.active;
  const mood = realMood(current?.mood);
  const moodName = mood ? MOOD_LABEL[mood] : null;
  const objects = current?.objects ?? [];
  const nObj = current ? coloredCount(current) : 0;
  const est = renderEstimate(mood);
  const [sim] = useState(() => makeRun(est.stages, moodName));
  const [phase, setPhase] = useState<Phase>('run');
  const [runKey, setRunKey] = useState(0);
  const [t, setT] = useState(() => (frozen ? Math.min(TOUR_FREEZE_S, sim.total * .4) : 0));
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);
  const [confirming, setConfirming] = useState(false);
  const [auto, setAuto] = useState<number | null>(null); // seconds until Results open; null = stayed
  const [live, setLive] = useState('');
  const finished = useRef(false);
  const openBtn = useRef<HTMLAnchorElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const againBtn = useRef<HTMLButtonElement>(null);
  const lastQ = useRef(0), lastSt = useRef(1);

  // the run: wall clock × speed, painted every 100 ms
  useEffect(() => {
    if (phase !== 'run' || frozen) return;
    // continue from where the run stands (0 on a new run; mid-run after the tour's freeze)
    const speed = sim.total / DEMO_SECONDS, wall0 = performance.now() - (tRef.current / speed) * 1000;
    const id = window.setInterval(() => {
      const now = ((performance.now() - wall0) / 1000) * speed;
      if (now >= sim.total) {
        window.clearInterval(id);
        setT(sim.total); setPhase('done'); setConfirming(false); setAuto(5);
        if (!finished.current) { finished.current = true; dispatch({ type: 'finishRender' }); }
        setLive(`Completed in ${fmt(sim.total)}. Results are ready.`);
        requestAnimationFrame(() => openBtn.current?.focus({ preventScroll: true }));
        return;
      }
      setT(now);
      const r = sim.at(now), pct = Math.floor(r.p * 100), q = Math.floor(pct / 25);
      if (r.st !== lastSt.current) { lastSt.current = r.st; setLive(`Stage 2 of 2 started: ${moodName} mood.`); }
      else if (q > lastQ.current && q < 4) { lastQ.current = q; setLive(pct + ' percent rendered.'); }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, runKey, sim, dispatch, moodName, frozen]);

  // Results open by themselves 5 s after the run ends (unless "Stay on this page")
  useEffect(() => {
    if (auto == null || frozen) return; // never pulled away from the tour
    if (auto <= 0) { go('results', undefined, { replace: true }); return; }
    const id = window.setTimeout(() => setAuto(a => (a == null ? a : a - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [auto, frozen]);

  const stop = () => {
    setPhase('stopped'); setConfirming(false);
    setLive('Render stopped. Nothing was saved.');
    requestAnimationFrame(() => againBtn.current?.focus());
  };
  const again = () => { lastQ.current = 0; lastSt.current = 1; setT(0); setPhase('run'); setRunKey(k => k + 1); };
  const keep = useCallback(() => { setConfirming(false); requestAnimationFrame(() => cancelBtn.current?.focus()); }, []);

  const done = phase === 'done', stopped = phase === 'stopped';
  const r = done ? { st: sim.stages, ip: 1, p: 1, msg: '', done: FRAMES } : sim.at(t);
  const pct = Math.floor(r.p * 100);
  const stageState = (i: number) => (done ? 'done' : r.st > i ? 'done' : r.st === i ? (stopped ? 'wait' : 'now') : 'wait');
  const graded = sim.stages === 2 && r.st === 2;
  const last = r.done - 1;
  // the latest finished frame
  let look: 'gray' | 'color' | 'graded' = 'gray', idx = 0, cap1 = 'Waiting for the first frame';
  if (done) { look = mood ? 'graded' : 'color'; idx = FRAMES - 1; cap1 = `Last frame: ${FRAMES} of ${FRAMES}`; }
  else if (!(r.st === 1 && last < 0)) {
    idx = graded && last < 0 ? FRAMES - 1 : last;
    look = graded && last >= 0 ? 'graded' : 'color';
    cap1 = `Latest finished frame: ${idx + 1} of ${FRAMES}`;
  }
  const pan = look === 'gray' ? .5 : done ? .98 : (idx + .5) / FRAMES;
  const unit = graded ? 'graded' : 'colored';

  // Safety net only: DemoApp opens or creates a project before any step screen renders (needsProject), so this is not normally reached.
  if (!current) {
    return <EmptyStep step={5} reached={4} title="Nothing to render" text="Open a project and choose its mood first." to="projects" action="Go to Projects" />;
  }
  return (
    <>
      <TopBar kind="step" step={5} reached={done ? 5 : 4} lockPast={!done && !stopped} nowNote={done ? ' (ready)' : ' (rendering)'} tourStep={TOUR_FIRST.render} />
      <main className={'sp sp-render' + (confirming ? ' confirming' : '') + (done ? ' is-done' : '') + (stopped ? ' is-stopped' : '')}>
        <section className="sp-stage" aria-label="Latest finished frame">
          <div className="viewer rstage">
            <div className="rframe" data-look={look}>
              <PanScene pan={pan} objects={objects} mood={look === 'graded' ? mood : null} color={look !== 'gray'} />
              <div className="caps"><span className="chip">{cap1}</span>{look === 'graded' && moodName && <span className="chip">{moodName}</span>}</div>
            </div>
          </div>
          <div className="card strip-card">
            <div className="strip-h"><h2>Frames</h2><span>{(done ? FRAMES : r.done) + ' of ' + FRAMES + ' ' + (done ? (mood ? 'graded' : 'colored') : unit)}</span></div>
            <div className="rstrip" aria-hidden="true">
              {Array.from({ length: FRAMES }, (_, i) => (
                <Cell key={i} i={i} objects={objects} mood={mood}
                  state={done ? (mood ? 'grd' : 'col') : graded ? (i < r.done ? 'grd' : 'col') : i < r.done ? 'col' : ''}
                  cur={!done && !stopped && i === r.done && r.done < FRAMES} />
              ))}
            </div>
          </div>
        </section>

        <aside className="sp-panel card runp" aria-labelledby="rttl">
          <h1 id="rttl">{current?.name}</h1>
          <p className="lede">Rendering takes about {est.text} for this {CLIP_PHRASE}. Results open when it finishes.</p>
          <div className="overall" data-tour="tut_render_progress">
            <div className="ov-row"><span className="pct">{pct}%</span><span className="ovn">Overall</span></div>
            <div className="rbar" role="progressbar" aria-label="Overall render progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <i style={{ '--p': r.p.toFixed(4) } as CSSProperties} />
            </div>
          </div>
          <ol className="stages" aria-label="Stages" data-tour="tut_render_progress">
            <li className={'stg ' + stageState(1)}>
              <span className="ic" aria-hidden="true">{stageState(1) === 'done' && CHECK}</span>
              <div><div className="k">Stage 1 of {sim.stages}{stopped && r.st === 1 ? ', stopped' : ''}<span className="sr">, {stageState(1) === 'done' ? 'done' : stageState(1) === 'now' ? 'running' : 'waiting'}</span></div>
                <div className="t">Coloring {nObj === 1 ? '1 object' : nObj + ' objects'} across {FRAMES} frames</div></div>
              <div className="msg">{r.st === 1 ? r.msg : ''}</div>
            </li>
            {sim.stages === 2 && (
              <li className={'stg ' + stageState(2)}>
                <span className="ic" aria-hidden="true">{stageState(2) === 'done' && CHECK}</span>
                <div><div className="k">Stage 2 of 2{stopped && r.st === 2 ? ', stopped' : ''}<span className="sr">, {stageState(2) === 'done' ? 'done' : stageState(2) === 'now' ? 'running' : 'waiting'}</span></div>
                  <div className="t">{moodName} mood</div></div>
                <div className="msg">{r.st === 2 ? r.msg : ''}</div>
              </li>
            )}
          </ol>
          <dl className="stats" data-tour="tut_render_progress">
            <div className="stat"><dt>Elapsed</dt><dd>{fmt(done ? sim.total : t)}</dd></div>
            <div className="stat"><dt>{done ? 'Time left' : 'Time left, est.'}</dt><dd>{done ? 'None' : stopped ? 'Stopped' : about(sim.remaining(t, r))}</dd></div>
            <div className="stat"><dt>{graded || (done && mood) ? 'Frames graded' : 'Frames colored'}</dt><dd>{r.done} of {FRAMES}</dd></div>
          </dl>
          <p className="est">{r.ip < .20 && r.st === 1 ? 'Estimated from earlier runs on this computer.' : 'Estimated from this run’s speed and earlier runs.'}</p>

          <div className="foot">
            {!done && !stopped && !confirming && <button ref={cancelBtn} className="btn btn-ghost" type="button" id="cancel" data-tour="tut_cancel_render"
              onClick={() => setConfirming(true)}>Cancel render</button>}
            {confirming && !done && (
              <StopConfirm id="cf-t" title="Stop rendering?" text="Frames finished so far are discarded. Your colors and mood stay as they are."
                keepLabel="Keep rendering" stopLabel="Stop render" onKeep={keep} onStop={stop} />
            )}
            {done && (
              <div className="done-box">
                <div className="ok"><i>{CHECK}</i><span>Completed in {fmt(sim.total)}</span></div>
                <p>{auto == null ? 'Results are ready whenever you are.' : `Results open by themselves in ${auto} second${auto === 1 ? '' : 's'}.`}</p>
                <a ref={openBtn} className="btn btn-pink btn-lg" href={demoHref('results')} onClick={e => { e.preventDefault(); go('results', undefined, { replace: true }); }}>Open results</a>
                {auto != null && <button className="btn btn-quiet" type="button" onClick={() => { setAuto(null); openBtn.current?.focus(); }}>Stay on this page</button>}
              </div>
            )}
            {stopped && (
              <div className="stopped-box">
                <b>Render stopped</b>
                <p>Nothing was saved. Your colors and mood are unchanged.</p>
                <button ref={againBtn} className="btn btn-pink btn-lg" type="button" onClick={again}>Render video</button>
                <button className="btn btn-quiet" type="button" onClick={() => go('mood')}>Back to Mood</button>
              </div>
            )}
          </div>
          <div className="sr" aria-live="polite">{live}</div>
        </aside>
      </main>
    </>
  );
}

/** A 16:9 window panned across the 2100×900 scene (transform only). */
const PanScene = memo(function PanScene({ pan, objects, mood, color }: { pan: number; objects: SceneObject[]; mood: MoodKey | null; color: boolean }) {
  return (
    <div className="pan" style={{ transform: `translateX(${-pan * 23.8095}%)` }}>
      <Scene variant={color ? 'color' : 'gray'} objects={color ? objects : undefined} mood={mood} />
    </div>
  );
});

const Cell = memo(function Cell({ i, objects, mood, state, cur }: { i: number; objects: SceneObject[]; mood: MoodKey | null; state: '' | 'col' | 'grd'; cur: boolean }) {
  const w = 900 * 0.6, x = Math.round(((i + .5) / FRAMES) * (2100 - w));
  const vb = `${x} 0 ${w} 900`;
  return (
    <div className={'rcell' + (state ? ' ' + state : '') + (cur ? ' cur' : '')}>
      <Scene variant="gray" viewBox={vb} />
      {state && <div className="c"><Scene variant="color" objects={objects} viewBox={vb} mood={state === 'grd' ? mood : null} /></div>}
    </div>
  );
});
