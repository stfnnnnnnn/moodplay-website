import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import './steps.css';
import './mood.css';
import { TopBar } from '../chrome/TopBar';
import { HoldButton } from '../chrome/HoldButton';
import { Scene } from '../scene';
import { isColor, useDemo, type MoodKey } from '../store';
import { go } from '../nav';
import { useHoldSpace } from '../parts/HoldSpace';
import { reachedFor } from '../parts/flow';
import { renderEstimate } from '../parts/estimate';
import { EmptyStep } from '../parts/EmptyStep';
import { CLIP, CLIP_PHRASE, CROP, MOOD_LABEL, MOOD_PAL, clipTime2 } from '../format';
import { FrameThumbs } from '../parts/FrameThumbs';

/* Mood (v5-mood.html): a 2×2 board with the same frame in all four looks (arrow keys move, the selection is a
   pink ring, the corner button opens a larger preview), the detail pane (what it does to each tone, what it
   suits, before and after), Skip ("Use a mood" once skipped) and Render video. No keyboard hints on the page. */

interface MoodDef { key: MoodKey; name: string; desc: string; pal: string[]; tones: [string, string, string, string][]; fit: string }
const MOODS: MoodDef[] = [
  { key: 'none', name: MOOD_LABEL.none, desc: 'True-to-life color with no grade on top. Object colors look exactly as you chose them.', pal: MOOD_PAL.none,
    tones: [['Shadows', 'Graphite', '#3F4654', 'Kept as they are, with no tint.'], ['Midtones', 'Slate', '#8FA0B5', 'Left alone, so skin looks natural.'], ['Highlights', 'Stone', '#D9D4CB', 'Kept clean and neutral.']],
    fit: 'Home movies, interviews, documentaries.' },
  { key: 'tokyo', name: MOOD_LABEL.tokyo, desc: 'Deep navy shadows with pink neon highlights, like a city street at night.', pal: MOOD_PAL.tokyo,
    tones: [['Shadows', 'Navy', '#0D1B3D', 'Pushed toward deep navy.'], ['Midtones', 'Electric blue', '#4C7BD9', 'Cooled with a blue cast.'], ['Highlights', 'Neon pink', '#E0447F', 'Lifted with a pink glow.']],
    fit: 'Night streets, city lights and rain.' },
  { key: 'sunny', name: MOOD_LABEL.sunny, desc: 'Golden light and warm skin tones, like a late summer afternoon.', pal: MOOD_PAL.sunny,
    tones: [['Shadows', 'Apricot', '#E8833A', 'Warmed to a soft brown.'], ['Midtones', 'Gold', '#F2B23A', 'Golden, with warmer skin tones.'], ['Highlights', 'Cream', '#FBE3B0', 'Softened to a creamy glow.']],
    fit: 'Beaches, gardens and summer daylight.' },
  { key: 'blues', name: MOOD_LABEL.blues, desc: 'Soft, cool and quiet. Muted blues with gentle contrast.', pal: MOOD_PAL.blues,
    tones: [['Shadows', 'Steel', '#3E6A8C', 'Cooled to a muted steel blue.'], ['Midtones', 'Mist', '#8FB3C9', 'Calmer, with gentle contrast.'], ['Highlights', 'Haze', '#DCE6EE', 'Softened to a pale, misty blue.']],
    fit: 'Quiet rooms, rainy days and the sea.' },
];
const Dots = ({ m }: { m: MoodDef }) => <span className="dots" aria-hidden="true">{m.pal.map(c => <i key={c} style={{ background: c }} />)}</span>;

export default function Mood() {
  const { dispatch, current } = useDemo();
  const hold = useHoldSpace();
  const objects = useMemo(() => current?.objects ?? [], [current]);
  const [sel, setSel] = useState(() => Math.max(0, MOODS.findIndex(m => m.key === (current?.mood ?? 'tokyo'))));
  const [skip, setSkip] = useState(false);
  const [big, setBig] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const [at, setAt] = useState(48); // the filmstrip frame shown in the header
  const tiles = useRef<(HTMLDivElement | null)[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const m = MOODS[sel];
  const shownObjs = hold.held ? undefined : objects;
  const grade = (k: MoodKey) => (hold.held ? null : k);
  const nColored = objects.filter(o => isColor(o.color)).length;
  const est = renderEstimate(skip ? 'none' : m.key);

  const choose = (i: number, focus?: boolean) => {
    const n = (i + 4) % 4;
    setSel(n); setSkip(false); dispatch({ type: 'setMood', mood: MOODS[n].key });
    if (focus && !big) tiles.current[n]?.focus();
  };
  const openBig = (i: number) => {
    choose(i);
    const r = tiles.current[i]?.getBoundingClientRect(), w = wrap.current?.getBoundingClientRect();
    if (r && w) setOrigin(`${((r.left + r.width / 2 - w.left) / w.width) * 100}% ${((r.top + r.height / 2 - w.top) / w.height) * 100}%`);
    setBig(true);
    requestAnimationFrame(() => closeBtn.current?.focus());
  };
  const closeBig = () => { setBig(false); requestAnimationFrame(() => tiles.current[sel]?.focus()); };
  const toggleSkip = () => { const s = !skip; setSkip(s); if (big) closeBig(); if (!s) dispatch({ type: 'setMood', mood: m.key }); };
  const render = () => {
    dispatch({ type: 'setMood', mood: skip ? 'none' : m.key });
    go('render');
  };

  // arrow keys move around the board (and between moods in the larger preview); Escape closes it
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as Element).matches('input,textarea')) return;
    if (e.key === 'Escape' && big) { e.preventDefault(); closeBig(); return; }
    if (e.key === 'Enter' && (e.target as Element).classList.contains('tile')) { e.preventDefault(); openBig(sel); return; }
    if (e.key === ' ' && (e.target as Element).classList.contains('tile')) { e.preventDefault(); choose(sel); return; } // radios take Space
    const d = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 } as Record<string, number>)[e.key];
    if (d === undefined) return;
    e.preventDefault();
    if (big) { choose(sel + (d > 0 ? 1 : -1)); return; }
    let r = Math.floor(sel / 2), c = sel % 2;
    if (d === -1) c = 0; if (d === 1) c = 1; if (d === -2) r = 0; if (d === 2) r = 1;
    choose(r * 2 + c, true);
  };
  useEffect(() => {
    // arrows also work when nothing is focused (the page body), as in the mockup
    const onDoc = (e: globalThis.KeyboardEvent) => {
      if (document.activeElement !== document.body || !/^Arrow/.test(e.key)) return;
      e.preventDefault(); tiles.current[sel]?.focus();
    };
    window.addEventListener('keydown', onDoc);
    return () => window.removeEventListener('keydown', onDoc);
  }, [sel]);

  // Safety net only: DemoApp opens or creates a project before any step screen renders (needsProject), so this is not normally reached.
  if (!current) {
    return <EmptyStep step={4} title="No project open" text="Open a project to choose its mood." to="projects" action="Go to Projects" />;
  }
  return (
    <>
      <TopBar kind="step" step={4} reached={reachedFor(current, 4)} extra={<HoldButton hold={hold} />} />
      <main className={'sp sp-mood' + (hold.held ? ' holding' : '')}>
        <section className="sp-stage" aria-label="Mood board">
          <div ref={wrap} className={'boardwrap' + (big ? ' open' : '')} onKeyDown={onKey} data-tour="tut_mood_board">
            <div className={'board' + (skip ? ' skipped' : '')} id="board" role="radiogroup" aria-label="Moods" inert={big} data-tour="btn_style_board">
              {MOODS.map((x, i) => (
                <div key={x.key} className="cell">
                  <div ref={el => { tiles.current[i] = el; }} className="tile" role="radio" aria-checked={!skip && i === sel} tabIndex={i === sel ? 0 : -1}
                    aria-label={x.name} data-tour={'btn_style_' + x.key} onClick={() => choose(i)} onDoubleClick={() => openBig(i)}>
                    <div className="tview">
                      <span className="chip ochip" aria-hidden="true">Original</span>
                      <div className="mframe"><Scene variant="gray" objects={shownObjs} viewBox={CROP} mood={grade(x.key)} /></div>
                    </div>
                    <div className="cap"><h3>{x.name}</h3><Dots m={x} /><span className="chip selchip">Selected</span></div>
                  </div>
                  <button className="xp" type="button" aria-label={`Open ${x.name} larger`} onClick={() => openBig(i)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="big" role="region" aria-label="Larger preview" inert={!big} style={{ transformOrigin: origin }}>
              <div className="tview">
                <span className="chip ochip" aria-hidden="true">Original</span>
                <div className="mframe">
                  <Scene variant="gray" objects={shownObjs} viewBox={CROP} />
                  {MOODS.map(x => x.key !== 'none' && <span key={x.key} className={'grade g-' + x.key + (x.key === m.key && !hold.held ? ' on' : '')} aria-hidden="true" />)}
                </div>
              </div>
              <div className="cap"><h3>{m.name}</h3><Dots m={m} /><span className="chip selchip">Selected</span><span className="grow" />
                <button className="btn btn-quiet ib" type="button" aria-label="Previous mood" onClick={() => choose(sel - 1)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg></button>
                <button className="btn btn-quiet ib" type="button" aria-label="Next mood" onClick={() => choose(sel + 1)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></button>
                <button ref={closeBtn} className="btn btn-line" type="button" aria-label="Back to all moods" onClick={closeBig}>Back</button>
              </div>
            </div>
          </div>
          <div className="fthumbs card">
            <div className="fhead"><span>Preview frame <b>{at}</b> of {CLIP.frames}</span><span>{clipTime2(at / CLIP.fps)} / {clipTime2(CLIP.seconds)}</span></div>
            <FrameThumbs objects={shownObjs} mood={skip ? null : grade(m.key)} at={at} onPick={setAt} label="Preview frames" itemLabel="Preview frame " />
          </div>
        </section>

        <aside className="sp-panel card" aria-label="Mood controls">
          <div className="ph"><h1>Mood</h1><p>Pick one look for the whole video.</p></div>
          <div className="pbody">
            <div aria-live="polite">
              <h2 className="mname">{skip ? 'No mood' : m.name}</h2>
              <p className="mdesc">{skip ? 'The video keeps the colors you chose in Colorize, with no look on top.' : m.desc}</p>
            </div>
            <div className="mmore">
              <h3 className="plbl" id="toneH">{skip ? 'Colors in the video' : 'What it does'}</h3>
              <ul className={'mtones' + (skip ? ' objs' : '')} aria-labelledby="toneH">
                {skip
                  ? objects.map(o => <li key={o.id}><span className="obj">{o.id}</span><b>{o.label}</b>{isColor(o.color) ? <i style={{ background: o.color }} aria-hidden="true" /> : <i className="nocol" aria-hidden="true" />}</li>)
                  : m.tones.map(t => <li key={t[0]}><i style={{ background: t[2] }} aria-hidden="true" /><b>{t[0]}<span>{t[1]}</span></b><p>{t[3]}</p></li>)}
              </ul>
              <h3 className="plbl">Works well for</h3>
              <p className="mfit">{skip ? 'Clips where your colors carry the look.' : m.fit}</p>
            </div>
            <div className="mba" aria-hidden="true"><div className="mba-in">
              <h3 className="plbl">Before and after</h3>
              <div className="bas">
                <figure><div className="mframe"><Scene variant="gray" viewBox={CROP} /></div><figcaption>Original</figcaption></figure>
                <figure><div className="mframe"><Scene variant="gray" objects={objects} viewBox={CROP} mood={skip ? null : m.key} /></div><figcaption>{skip ? 'Your colors' : m.name}</figcaption></figure>
              </div>
            </div></div>
          </div>
          <div className="pfoot">
            <div className="done-row"><span>{nColored === 1 ? '1 object' : nColored + ' objects'} colorized</span><button className="btn btn-quiet bsm" type="button" aria-label="Edit object colors" onClick={() => go('colorize')}>Edit</button></div>
            {/* Computed estimate (parts/estimate.ts): frames to colorize × seconds per frame from earlier runs on this machine. */}
            <p className="note" id="rnote" data-tour="btn_apply_note">Rendering takes about {est.text} for this {CLIP_PHRASE}. Results open when it finishes.</p>
            <button className="btn btn-pink btn-lg full" type="button" onClick={render} data-tour="btn_apply">Render video</button>
            <button className="btn btn-quiet full" id="skip" type="button" aria-label={skip ? 'Use a mood' : 'Skip mood'} onClick={toggleSkip} data-tour="tut_skip_mood">{skip ? 'Use a mood' : 'Skip'}</button>
          </div>
        </aside>
      </main>
    </>
  );
}
