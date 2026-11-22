import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import sceneGray from '../assets/landing/scene-gray.svg';
import sceneColor from '../assets/landing/scene-color.svg';
import { BOXES, MOODS, OBJECTS, STEPS, prefersReducedMotion, type MoodKey } from './data';
import { Grades, Knob, Swatch, UploadIcon } from './parts';
import { useReveal } from './useReveal';

/** Shrinking gaps so the boxes and pins land as one wave. */
const WAVE = ['0ms', '60ms', '100ms', '130ms', '150ms'];

/** Thumbnails mirror what each step shows, on the same 21:9 framing. */
function Thumb({ n }: { n: number }) {
  if (n === 1) return <span className="mupl" aria-hidden="true"><UploadIcon size={14} stroke={2.6} /></span>;
  if (n === 2) return <><img src={sceneGray} alt="" /><span className="mbox" aria-hidden="true" /></>;
  if (n === 3) return <img src={sceneColor} alt="" />;
  if (n === 4) return <><img src={sceneColor} alt="" /><span className="mgrade" aria-hidden="true" /></>;
  return (
    <>
      <img src={sceneGray} alt="" />
      <span className="msplit" aria-hidden="true"><img src={sceneColor} alt="" /></span>
    </>
  );
}

/** "See each step" — one box: five tabs, one frame that changes per step, and the step copy. */
export default function Steps() {
  const [step, setStep] = useState(1);
  const [mood, setMood] = useState<MoodKey>('sunny');
  const [split, setSplit] = useState(50);
  const [holding, setHolding] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const railRef = useRef<HTMLOListElement | null>(null);
  const [sectionRef] = useReveal<HTMLElement>(0.12);

  // On phones the tab row scrolls sideways: keep the chosen step in view without moving the page.
  useEffect(() => {
    const rail = railRef.current, tab = tabRefs.current[step - 1];
    if (!rail || !tab || rail.scrollWidth <= rail.clientWidth) return;
    const left = tab.offsetLeft - (rail.clientWidth - tab.offsetWidth) / 2;
    rail.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [step]);

  const current = STEPS[step - 1];
  const moodLabel = MOODS.find((m) => m.key === mood)!.label;
  const tag = holding ? 'Original' : current.tag || moodLabel;

  const onTabKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + STEPS.length) % STEPS.length;
    setStep(j + 1);
    tabRefs.current[j]?.focus();
  };

  const startHold = () => setHolding(true);
  const endHold = () => setHolding(false);

  return (
    <section className="steps" id="steps" aria-labelledby="sh" data-rv ref={sectionRef}>
      <span className="sbloom" style={{ width: 680, height: 680, left: -340, top: '8%', background: 'radial-gradient(closest-side, #FFD6E5 35%, #FFD6E500 100%)' }} aria-hidden="true" />
      <span className="sbloom" style={{ width: 720, height: 720, right: -360, bottom: '2%', background: 'radial-gradient(closest-side, #D3E2FB 35%, #D3E2FB00 100%)' }} aria-hidden="true" />
      <div className="steps-head">
        <h2 id="sh" className="rv">See each step</h2>
        <p className="rv" style={{ '--d': '80ms' } as CSSProperties}>Five steps from a black-and-white clip to a finished video. Pick a step, then hold the eye on the frame to see the original.</p>
      </div>

      <div className="studio rv rv-lift" style={{ '--d': '160ms' } as CSSProperties} data-step={step}>
        <ol className="rail" role="tablist" aria-label="Steps" ref={railRef}>
          {STEPS.map((s, i) => (
            <li key={s.n}>
              <button
                ref={(el) => { tabRefs.current[i] = el; }}
                className={`tab${s.n < step ? ' done' : ''}`}
                role="tab"
                type="button"
                aria-selected={step === s.n}
                aria-controls="step-panel"
                tabIndex={step === s.n ? 0 : -1}
                onClick={() => setStep(s.n)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                <span className="mf"><Thumb n={s.n} /></span>
                <span className="t"><b>{s.name}</b><small>{s.sub}</small></span>
              </button>
            </li>
          ))}
        </ol>

        <div className="bench" id="step-panel" role="tabpanel" aria-live="polite">
          <div className={`ss${holding ? ' holding' : ''}`} data-step={step} style={{ '--split': split } as CSSProperties}>
            <div className="lay base"><img src={sceneGray} alt="Original black-and-white frame" /></div>
            <div className="lay l-detect">
              {BOXES.map((b, i) => (
                <div key={b.name} className={`box${b.labelRight ? ' r' : ''}`} style={{ left: b.left, top: b.top, width: b.width, height: b.height, '--pd': WAVE[i] } as CSSProperties}>
                  <span>{b.name}</span>
                </div>
              ))}
            </div>
            <div className="lay l-color">
              <img src={sceneColor} alt="Colorized frame" />
              {OBJECTS.map((o, i) => (
                <span key={o.name} className="pin" style={{ left: o.left, right: o.right, top: o.top, '--pd': WAVE[i] } as CSSProperties}>
                  <i style={{ background: o.hex }} />
                  {o.name} <span>{o.hex}</span>
                </span>
              ))}
            </div>
            <div className="lay l-mood">
              <img src={sceneColor} alt="Colorized frame with a mood" />
              <Grades mood={mood} />
            </div>
            <div className="lay l-result">
              <img src={sceneColor} alt="Finished frame" />
              <Grades mood={mood} />
            </div>
            <div className="lay l-drop">
              <div className="upl">
                <span className="ub b1" aria-hidden="true" />
                <span className="ub b2" aria-hidden="true" />
                <div className="ucard">
                  <span className="uicon"><UploadIcon /></span>
                  <b>Drop a black-and-white video</b>
                  <small>MP4, MOV or AVI</small>
                  <span className="ubtn">Choose a video</span>
                </div>
              </div>
            </div>
            <input
              className="range"
              type="range"
              min={0}
              max={100}
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
              aria-label="Compare original and result"
            />
            <div className="handle"><Knob /></div>
            <span className="stag">{tag}</span>
            {/* Compact press-and-hold peek: the step frame is the subject, so the control stays small and in a corner. */}
            <button
              className="peek"
              type="button"
              aria-label="Hold to see the original"
              aria-pressed={holding}
              onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); startHold(); }}
              onPointerUp={endHold}
              onPointerCancel={endHold}
              onContextMenu={(e) => e.preventDefault()}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); startHold(); } }}
              onKeyUp={endHold}
              onBlur={endHold}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="peek-tip" aria-hidden="true">Hold to see the original</span>
            </button>
          </div>

          <div className="copy">
            <div className="anim" key={step}>
              <div className="k">Step {step} of 5</div>
              <h3>{current.title}</h3>
              <p>{current.body}</p>
            </div>
            {step === 4 && (
              <div className="extra">
                <div className="chips" role="radiogroup" aria-label="Mood">
                  {MOODS.map((m) => (
                    <button key={m.key} type="button" className="mood" role="radio" aria-checked={mood === m.key} onClick={() => setMood(m.key)}>
                      <Swatch mood={m} />
                      {m.short}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
