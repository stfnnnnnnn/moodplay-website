import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import sceneGray from '../assets/landing/scene-gray.svg';
import sceneColor from '../assets/landing/scene-color.svg';
import { FILM_FRAMES, MOODS, OBJECTS, prefersReducedMotion, type MoodKey } from './data';
import { Grades, Knob, Swatch } from './parts';
import { useReveal } from './useReveal';

/** Entry delays for the object pins: shrinking gaps read as one wave, not a queue. */
const PIN_DELAY = ['0ms', '60ms', '100ms', '130ms', '150ms'];

const FEATURES = [
  { spot: 1, num: '01', title: 'Object color control' },
  { spot: 2, num: '02', title: 'No flicker' },
  { spot: 3, num: '03', title: 'Mood styles' },
];

/** "Your colors. Your mood." — a vertical feature list that switches what the player shows. */
export default function Features() {
  const [spot, setSpot] = useState(1);
  const [split, setSplit] = useState(() => (prefersReducedMotion() ? 55 : 8));
  const [mood, setMood] = useState<MoodKey>('none');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [sectionRef, inView] = useReveal<HTMLElement>();
  const cmpRef = useRef<HTMLDivElement | null>(null);
  const rangeRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const sweepRef = useRef(0);

  const stopSweep = () => {
    cancelAnimationFrame(sweepRef.current);
    sweepRef.current = 0;
    if (wrapRef.current) delete wrapRef.current.dataset.sweep;
  };

  // Open the comparison once, when the section is actually seen. Frames write straight to the
  // element (no React state per frame); state is set once at the end. Dragging interrupts it.
  useEffect(() => {
    if (!inView || prefersReducedMotion()) return;
    const timer = window.setTimeout(() => {
      const cmp = cmpRef.current, range = rangeRef.current, wrap = wrapRef.current;
      if (!cmp || !range || !wrap) return;
      wrap.dataset.sweep = '';
      const t0 = performance.now();
      const frame = (t: number) => {
        const k = Math.min(1, (t - t0) / 1300);
        const v = 8 + 47 * (1 - Math.pow(1 - k, 3));
        cmp.style.setProperty('--split', String(v));
        range.value = String(Math.round(v));
        if (k < 1) sweepRef.current = requestAnimationFrame(frame);
        else { stopSweep(); setSplit(55); }
      };
      sweepRef.current = requestAnimationFrame(frame);
    }, 520);
    return () => { window.clearTimeout(timer); stopSweep(); };
  }, [inView]);

  const onTabKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + FEATURES.length) % FEATURES.length;
    setSpot(FEATURES[j].spot);
    tabRefs.current[j]?.focus();
  };

  const moodLabel = MOODS.find((m) => m.key === mood)!.label;

  return (
    <section className="feats" id="features" aria-labelledby="fh" data-rv ref={sectionRef}>
      <div className="wrap wide">
        <h2 id="fh" className="rv"><span className="p">Your colors.</span> <span className="b">Your mood.</span></h2>
        <div className="stagewrap" data-spot={spot} ref={wrapRef}>
          <ol className="frail" role="tablist" aria-label="Features">
            {FEATURES.map((f, i) => (
              <li key={f.spot} className="rv rv-x" style={{ '--d': `${120 + i * 50 - i * i * 5}ms` } as CSSProperties}>
                <button
                  ref={(el) => { tabRefs.current[i] = el; }}
                  role="tab"
                  type="button"
                  aria-selected={spot === f.spot}
                  aria-controls="feature-player"
                  tabIndex={spot === f.spot ? 0 : -1}
                  onClick={() => setSpot(f.spot)}
                  onKeyDown={(e) => onTabKey(e, i)}
                >
                  <em>{f.num}</em>
                  <b>{f.title}</b>
                </button>
              </li>
            ))}
          </ol>

          <div className="player rv rv-lift" style={{ '--d': '140ms' } as CSSProperties} id="feature-player" role="tabpanel" aria-label={FEATURES[spot - 1].title}>
            <div className="cmp" ref={cmpRef} style={{ '--split': split } as CSSProperties}>
              <img className="cmp-img" src={sceneGray} alt="Black-and-white street scene" />
              <div className="cmp-color">
                <img className="cmp-img" src={sceneColor} alt="The same scene colorized by MoodPlay" />
                <Grades mood={mood} />
                {OBJECTS.map((o, i) => (
                  <span key={o.name} className="pin" style={{ left: o.left, right: o.right, top: o.top, '--pd': PIN_DELAY[i] } as CSSProperties}>
                    <i style={{ background: o.hex }} />
                    {o.name} <span>{o.hex}</span>
                  </span>
                ))}
              </div>
              <span className="ptag l">Original</span>
              <span className="ptag r">MoodPlay with <span className="mood-label">{moodLabel}</span></span>
              <div className="filmover" aria-hidden={spot !== 2}>
                <div className="film">
                  {FILM_FRAMES.map((f) => (
                    <figure key={f.label}>
                      <span className="im"><img src={sceneColor} alt="" style={{ objectPosition: f.pos }} /></span>
                      <figcaption>{f.label}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
              <input
                className="compare-range"
                type="range"
                min={0}
                max={100}
                ref={rangeRef}
                value={Math.round(split)}
                onPointerDown={stopSweep}
                onChange={(e) => { stopSweep(); setSplit(Number(e.target.value)); }}
                aria-label="Compare original and colorized frame"
              />
              <div className="cmp-handle"><Knob /></div>
            </div>
            <div className="moods" role="radiogroup" aria-label="Mood">
              <span className="mlabel">Mood styles</span>
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className="mood"
                  role="radio"
                  aria-checked={mood === m.key}
                  tabIndex={spot === 3 ? 0 : -1}
                  onClick={() => setMood(m.key)}
                >
                  <Swatch mood={m} />
                  {m.short}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
