import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import './firstrun.css';
import { Scene } from '../scene';
import { useDemo, useDemoExtra } from '../store';
import { demoHref, go } from '../nav';
import { prefersReducedMotion } from '../ui';

/* First run (first-run-v3.html). Once per session (state.firstRunSeen):
   1. Launch: the compare handle sweeps across the wordmark and colours it, the stage lights come up,
      then the wordmark flies into the welcome heading while the dark backdrop wipes away.
   2. Welcome holds ~5 s (a click or key moves on; the timer pauses while the tab is hidden).
   3. Features, then How it works, with "Colorize my own video" and "Start tutorial". */

const HOLD = 5000;
const SCREENS = 3;
const FONT_ID = 'v5-bricolage';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&display=swap';

type Phase = 'play' | 'fly' | 'done';

export default function FirstRun() {
  const { dispatch } = useDemo();
  const { markFirstRunSeen } = useDemoExtra();
  const [reduce] = useState(prefersReducedMotion);
  const [cur, setCur] = useState(0);
  const [phase, setPhase] = useState<Phase>(reduce ? 'done' : 'play');
  const [landed, setLanded] = useState(reduce);

  const curRef = useRef(0);
  const phaseRef = useRef<Phase>(phase);
  const introRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const colrRef = useRef<HTMLSpanElement>(null);
  const handleRef = useRef<HTMLSpanElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);
  const timers = useRef<number[]>([]);
  const flight = useRef<Animation | null>(null);
  const auto = useRef<{ t: number | null; left: number; t0: number }>({ t: null, left: HOLD, t0: 0 });

  // The "How it works" numbers use Bricolage Grotesque (as in the mockup); load it only for the demo.
  useEffect(() => {
    if (document.getElementById(FONT_ID)) return;
    const l = document.createElement('link');
    l.id = FONT_ID; l.rel = 'stylesheet'; l.href = FONT_HREF;
    document.head.appendChild(l);
  }, []);

  const show = useCallback((i: number) => {
    i = Math.max(0, Math.min(SCREENS - 1, i));
    if (i === curRef.current) return;
    curRef.current = i;
    setCur(i);
    requestAnimationFrame(() => document.getElementById('fr-h' + i)?.focus({ preventScroll: true }));
  }, []);

  const autoStop = useCallback(() => {
    const a = auto.current;
    if (a.t != null) { clearTimeout(a.t); a.t = null; a.left = Math.max(0, a.left - (Date.now() - a.t0)); }
  }, []);
  const autoStart = useCallback(() => {
    autoStop();
    const a = auto.current;
    if (curRef.current !== 0 || phaseRef.current !== 'done' || document.hidden) return;
    a.t0 = Date.now();
    a.t = window.setTimeout(() => { a.t = null; if (curRef.current === 0) show(1); }, a.left);
  }, [autoStop, show]);

  const setP = useCallback((p: Phase) => { phaseRef.current = p; setPhase(p); }, []);

  const land = useCallback(() => {
    setP('done'); setLanded(true);
    auto.current.left = HOLD;
    autoStart();
  }, [autoStart, setP]);

  /* the wordmark flies into the welcome heading (FLIP), tinting to the brand colours on the way */
  const fly = useCallback((dur: number) => {
    if (phaseRef.current !== 'play') return;
    timers.current.forEach(clearTimeout); timers.current = [];
    const word = wordRef.current, colr = colrRef.current, handle = handleRef.current, tgt = targetRef.current;
    if (!word || !colr || !handle || !tgt) { land(); return; }
    word.style.animation = 'none'; word.style.opacity = '1';
    colr.style.animation = 'none'; colr.style.clipPath = 'inset(-20% -12% -20% 0)';
    handle.style.animation = 'none'; handle.style.opacity = '0';
    setP('fly');
    const a = word.getBoundingClientRect(), b = tgt.getBoundingClientRect(), k = b.width / a.width;
    flight.current = word.animate(
      [{ transform: 'none' }, { transform: `translate(${b.left - a.left}px,${b.top - a.top}px) scale(${k})` }],
      { duration: dur, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    timers.current.push(window.setTimeout(() => setLanded(true), dur * .55));
    flight.current.onfinish = () => { flight.current = null; land(); };
  }, [land, setP]);

  // Play once on mount.
  useEffect(() => {
    const ts = timers.current;
    if (reduce) { autoStart(); }
    else ts.push(window.setTimeout(() => fly(650), 2000));
    const onVis = () => { if (document.hidden) autoStop(); else autoStart(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      ts.forEach(clearTimeout);
      flight.current?.cancel();
      autoStop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reduce, fly, autoStart, autoStop]);

  // Keys: during the launch any key skips it; on the welcome any key moves on; then ← / → page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (phaseRef.current === 'play') { fly(380); return; }
      if (phaseRef.current === 'fly') return;
      if (curRef.current === 0) { if (e.key === 'Tab' || e.key === 'Shift') return; autoStop(); show(1); return; }
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('a,button,input')) return;
      if (e.key === 'ArrowRight') show(curRef.current + 1);
      else if (e.key === 'ArrowLeft') show(curRef.current - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fly, show, autoStop]);

  const startTutorial = () => {
    markFirstRunSeen();
    dispatch({ type: 'createSample' });
    dispatch({ type: 'tour', step: 1 });
    go('home', { tour: 1 });
  };
  const ownVideo = (e: MouseEvent) => {
    e.preventDefault();
    markFirstRunSeen();
    go('upload');
  };

  const introClass = 'intro ' + (phase === 'play' ? 'play' : phase === 'fly' ? 'play fly' : 'done');
  const rootClass = 'fr' + (phase !== 'done' ? ' entering' : '') + (landed ? ' landed' : '');
  const scr = (i: number) => 'scr' + (i === cur ? ' on' : '') + (i < cur ? ' past' : '');

  return (
    <div className={rootClass} data-s={cur}>
      {!reduce && (
        <div className={introClass} ref={introRef} role="presentation" title="Click to skip" onClick={() => fly(380)}>
          <div className="bg"><span className="light lb" /><span className="light lp" /></div>
          <div className="icenter">
            <div className="word" ref={wordRef} aria-label="MoodPlay">
              <span className="gray" aria-hidden="true">MoodPlay</span>
              <span className="colr" ref={colrRef} aria-hidden="true"><span className="m">Mood</span><span className="p">Play</span></span>
              <span className="handle" ref={handleRef} aria-hidden="true"><span className="knob"><i className="l" /><i className="r" /></span></span>
            </div>
            <p className="tag">Color every object. Set the mood.</p>
          </div>
          <span className="iskip">Click or press any key to skip</span>
        </div>
      )}

      <div className="fr-app">
        <span className="fr-bloom" style={{ width: 720, height: 720, left: -260, top: -180, background: 'rgba(255,184,210,.7)' }} aria-hidden="true" />
        <span className="fr-bloom" style={{ width: 760, height: 760, right: -280, top: 120, background: 'rgba(180,206,248,.75)' }} aria-hidden="true" />
        <span className="fr-bloom" style={{ width: 520, height: 520, left: '28%', bottom: -340, background: 'rgba(255,206,224,.55)' }} aria-hidden="true" />

        <header className="fr-top">
          <span className="wmk" aria-label="MoodPlay"><span className="m">Mood</span><span className="p">Play</span></span>
        </header>

        <main>
          {/* 1. welcome */}
          <section className={scr(0) + ' fr-hero'} aria-labelledby="fr-h0" aria-hidden={cur !== 0}
            onClick={() => { if (phaseRef.current === 'done' && curRef.current === 0) { autoStop(); show(1); } }}>
            <h1 id="fr-h0" tabIndex={-1}>
              <span className="w">Welcome to</span>
              <span className="wm" ref={targetRef}><span className="b">Mood</span><span className="p">Play</span></span>
            </h1>
          </section>

          {/* 2. features */}
          <section className={scr(1)} aria-labelledby="fr-h1" aria-hidden={cur !== 1}>
            <div className="sec-h"><h2 id="fr-h1" tabIndex={-1}><span className="p">Your colors.</span> <span className="b">Your mood.</span></h2></div>
            <div className="cards">
              <article className="fr-card">
                <div className="blob" aria-hidden="true" style={{ background: '#FCD3E2', borderRadius: '58% 42% 55% 45%/50% 60% 40% 50%', color: '#9E1F50' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
                </div>
                <div className="fx"><ul className="chiplist" aria-label="Object colors in this scene">
                  <li><i style={{ background: '#C8326B' }} /><b>Person 1</b><span>#C8326B</span></li>
                  <li><i style={{ background: '#E39B2D' }} /><b>Car</b><span>#E39B2D</span></li>
                  <li><i style={{ background: '#2A9C9C' }} /><b>Shopfront</b><span>#2A9C9C</span></li>
                  <li><i style={{ background: '#2F6FD6' }} /><b>Person 2</b><span>#2F6FD6</span></li>
                </ul></div>
                <div><h3>Object color control</h3><p>Choose a color for each person or object. It follows them as they move.</p></div>
              </article>
              <article className="fr-card">
                <div className="blob" aria-hidden="true" style={{ background: '#C9DCFA', borderRadius: '45% 55% 40% 60%/55% 45% 55% 45%', color: '#1A3D8F' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14" /></svg>
                </div>
                <div className="fx"><div className="fr-film" aria-hidden="true">
                  {[['Frame 1', .2], ['Frame 40', .35], ['Frame 80', .5], ['Frame 120', .65]].map(([label, p]) => (
                    <figure key={label}><span className="im"><Scene variant="color" viewBox={`${Math.round(1380 * (p as number))} 0 720 900`} /></span><figcaption>{label}</figcaption></figure>
                  ))}
                </div></div>
                <div><h3>No flicker</h3><p>Colors stay steady frame after frame, with no jumping or bleeding.</p></div>
              </article>
              <article className="fr-card">
                <div className="blob" aria-hidden="true" style={{ background: 'linear-gradient(90deg,#FCD3E2 50%,#C9DCFA 50%)', borderRadius: '52% 48% 60% 40%/45% 55% 45% 55%', color: '#0E1B33' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>
                </div>
                <div className="fx"><div className="bands" aria-hidden="true">
                  <Scene variant="color" />
                  <span className="g" style={{ left: 0 }} />
                  <span className="g g-tokyo" style={{ left: '25%' }} />
                  <span className="g g-sunny" style={{ left: '50%' }} />
                  <span className="g g-blues" style={{ left: '75%' }} />
                  <div className="lbls"><span>Neutral</span><span>Neo Tokyo</span><span>Warm Sunny</span><span>Sunday Blues</span></div>
                </div></div>
                <div><h3>Mood styles</h3><p>Four looks for the whole scene: Neutral Realistic, Neo Tokyo, Warm Sunny and Sunday Blues.</p></div>
              </article>
            </div>
          </section>

          {/* 3. how it works */}
          <section className={scr(2)} aria-labelledby="fr-h2" aria-hidden={cur !== 2}>
            <div className="sec-h"><h2 id="fr-h2" tabIndex={-1}>How it works</h2><p>Five steps from a black-and-white clip to a finished video.</p></div>
            <ol className="tl">
              <li style={{ '--c': 'var(--pink)' } as CSSProperties}><span className="n">01</span><h3>Upload</h3><p>Add a black-and-white clip. MP4, MOV or AVI.</p></li>
              <li style={{ '--c': 'var(--pink)' } as CSSProperties}><span className="n">02</span><h3>Detect</h3><p>MoodPlay finds the people and objects in every frame.</p></li>
              <li className="mid" style={{ '--c': 'var(--ink)' } as CSSProperties}><span className="n">03</span><h3>Colorize</h3><p>Pick a color for each object. Skip any to keep its original look.</p></li>
              <li style={{ '--c': 'var(--blue)' } as CSSProperties}><span className="n">04</span><h3>Mood</h3><p>Choose one look for the whole scene.</p></li>
              <li style={{ '--c': 'var(--blue)' } as CSSProperties}><span className="n">05</span><h3>Results</h3><p>Compare with the original and save the finished MP4.</p></li>
            </ol>
          </section>
        </main>

        <nav className="bar" aria-label="Welcome steps" aria-hidden={cur === 0} inert={cur === 0}>
          <span><button className="btn btn-quiet fr-back" type="button" onClick={() => show(cur - 1)}>Back</button></span>
          <span className="dots" aria-hidden="true">{[0, 1, 2].map(i => <i key={i} className={i === cur ? 'on' : undefined} />)}</span>
          <span className="r">
            {cur < 2 && <button className="btn btn-pink" type="button" onClick={() => show(cur + 1)}>Continue</button>}
            {cur === 2 && <a className="btn btn-line" href={demoHref('upload')} onClick={ownVideo}>Colorize my own video</a>}
            {cur === 2 && <button className="btn btn-pink" type="button" onClick={startTutorial} data-tour="tut_start_tutorial">Start tutorial</button>}
          </span>
        </nav>
      </div>
    </div>
  );
}
