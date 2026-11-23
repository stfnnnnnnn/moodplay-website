import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import './home.css';
import { TopBar } from '../chrome/TopBar';
import { IconPlus } from '../chrome/Icons';
import { StepBars, StepLabel } from '../chrome/StepBars';
import { Scene } from '../scene';
import { STEP_NAMES, coloredCount, isColor, useDemo, type Project } from '../store';
import { STEP_SCREENS, demoHref, go, linkClick } from '../nav';
import { MOOD_LABEL, day, plural, realMood, word, wordLower } from '../format';

/* Home (v5-home.html): the Resume frame (where you stopped, coloured objects in colour, the rest grey),
   the "Where you stopped" timeline card + Continue, then Recent projects. Empty state when there are none. */

const CONTINUE = ['Continue uploading', 'Continue detecting', 'Continue colorizing', 'Continue to mood', 'Open results'];

function helloCopy(p: Project): [string, string] {
  const n = coloredCount(p), total = p.objects.length;
  if (p.isSample && !p.finished && p.step === 3 && n === 0) {
    return ['Your sample project is ready', 'The objects are already found, so it opens at Colorize. Nothing has a color yet.'];
  }
  if (p.finished) return ['Welcome back', 'Your last project is finished. Open its results, or upload another video.'];
  const at = `Your last project stopped at ${STEP_NAMES[p.step - 1]}.`;
  if (p.step === 3) {
    const has = n === 0 ? 'No objects have a color yet.' : `${word(n)} of ${wordLower(total)} objects ${n === 1 ? 'has' : 'have'} a color.`;
    return ['Welcome back', `${at} ${has}`];
  }
  return ['Welcome back', at];
}

function useHoldSpace() {
  const [holding, setHolding] = useState(false);
  useEffect(() => {
    const skip = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('input,textarea,select,button,a,[contenteditable]');
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat && !skip(e.target)) { e.preventDefault(); setHolding(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setHolding(false); };
    const blur = () => setHolding(false);
    document.addEventListener('keydown', down); document.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);
  return holding;
}

function ResumeFrame({ p }: { p: Project }) {
  const holding = useHoldSpace();
  const n = coloredCount(p);
  const alt = `${p.name}, current frame: ` + (n === 0 ? 'nothing is colored yet' :
    p.objects.filter(o => isColor(o.color)).map(o => o.label).join(' and ') + (n === p.objects.length ? ' are colored' : ' are colored; the rest is still black and white'));
  return (
    <div className={'frame' + (holding ? ' holding' : '')} style={{ viewTransitionName: 'pthumb-' + p.id } as CSSProperties}>
      <div className="lay" role="img" aria-label={alt}><Scene variant="gray" objects={p.objects} mood={p.finished ? p.mood : null} /></div>
      <div className="orig" aria-hidden="true"><Scene variant="gray" /></div>
      {p.objects.map(o => {
        const c = isColor(o.color) ? o.color : null;
        const style = { left: `${((o.box[0] + o.box[2]) / 2 / 21).toFixed(1)}%`, top: `${(o.box[1] / 9).toFixed(1)}%` };
        return (
          <span key={o.id} className={'mk' + (c ? '' : ' wait')} style={style}>
            <span className="obj">{o.id}</span><span className="lbl">{o.label}</span>
            {c && <span className="sw" style={{ background: c }} />}
          </span>
        );
      })}
      <div className="shade" />
      <div className="cap">
        <div><div className="k">Continue where you left off</div><h2 id="rt" title={p.name}>{p.name}</h2></div>
      </div>
    </div>
  );
}

function WhereCard({ p }: { p: Project }) {
  const { dispatch } = useDemo();
  const n = coloredCount(p);
  const fill = p.finished ? 100 : ((p.step - 1) / 4) * 100;
  const target = p.finished ? 'results' : STEP_SCREENS[p.step - 1];
  return (
    <aside className="card where" aria-labelledby="wh" data-tour="tut_resume">
      <h3 id="wh">Where you stopped</h3>
      <ol className="wsteps" style={{ '--p': fill + '%' } as CSSProperties}>
        {STEP_NAMES.map((name, i) => {
          const s = i + 1;
          const cls = p.finished || s < p.step ? 'done' : s === p.step ? 'now' : undefined;
          return (
            <li key={name} className={cls} aria-current={cls === 'now' ? 'step' : undefined}>
              <span className="dot" />{name}
              {cls === 'now' && s === 3 && <span className="st">{n} of {p.objects.length}<span className="sr"> objects colored</span></span>}
            </li>
          );
        })}
      </ol>
      <a className="btn btn-pink btn-lg go" href={demoHref(target)} onClick={linkClick(target, undefined, () => dispatch({ type: 'open', id: p.id }))}>
        {CONTINUE[p.finished ? 4 : p.step - 1]}
      </a>
    </aside>
  );
}

function Tile({ p }: { p: Project }) {
  const mood = realMood(p.mood);
  return (
    <a className="tile" href={demoHref('project', { id: p.id })} onClick={linkClick('project', { id: p.id })} data-k={p.finished ? 'fin' : 'prog'}>
      <div className="th" style={{ viewTransitionName: 'pthumb-' + p.id } as CSSProperties}>
        <Scene variant={p.finished ? 'color' : 'gray'} objects={p.objects} mood={p.finished ? mood : null} />
        <span className={'chip badge ' + (p.finished ? 'fin' : 'prog')}>{p.finished ? 'Finished' : 'In progress'}</span>
        {p.renders.length > 0 && <span className="chip runs">{plural(p.renders.length, 'render', 'renders')}</span>}
      </div>
      <div className="nm" title={p.name}>{p.name}</div>
      <div className="dl">
        <span>{mood ? MOOD_LABEL[mood] : 'No mood yet'}</span>
        <span className="when"><span>{day(p.updated)}</span><StepBars project={p} /><StepLabel project={p} /></span>
      </div>
    </a>
  );
}

function FirstRunEmpty() {
  const { dispatch } = useDemo();
  const [busy, setBusy] = useState(false);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(t.current), []);
  return (
    <section className="first" aria-labelledby="fr-h">
      <div className="first-in" data-tour="tut_first_run">
        <div className="still" role="img" aria-label="The sample clip: a street with a shopfront, a car and three people, in black and white"><Scene variant="gray" /></div>
        <div>
          <h1 id="fr-h">Welcome to MoodPlay</h1>
          <p>You don't have any projects yet. Upload a black-and-white clip, or make a sample project and try every step on it first.</p>
          <div className="acts">
            <button className="btn btn-pink btn-lg" type="button" disabled={busy} data-tour="tut_make_sample"
              onClick={() => { setBusy(true); t.current = window.setTimeout(() => dispatch({ type: 'createSample' }), 700); }}>
              {busy ? 'Creating sample project…' : 'Create sample project'}
            </button>
            <span className="or">or use Upload video above</span>
          </div>
        </div>
      </div>
    </section>
  );
}

type Filter = 'all' | 'prog' | 'fin';

export default function Home() {
  const { state, current } = useDemo();
  const [filter, setFilter] = useState<Filter>('all');
  const byRecent = useMemo(() => state.projects.slice().sort((a, b) => b.updated.localeCompare(a.updated)), [state.projects]);
  const resume = current ?? byRecent[0] ?? null;
  const others = byRecent.filter(p => p !== resume).slice(0, 3);

  if (!resume) {
    return (<><TopBar kind="home" active="home" /><main className="home"><FirstRunEmpty /></main></>);
  }
  const [h, sub] = helloCopy(resume);
  const shown = (p: Project) => filter === 'all' || (filter === 'fin') === p.finished;

  return (
    <>
      <TopBar kind="home" active="home" />
      <main className="home">
        <div className="hello"><div><h1>{h}</h1><p>{sub}</p></div></div>
        <section className="resume" aria-labelledby="rt">
          <ResumeFrame p={resume} />
          <WhereCard p={resume} />
        </section>
        {others.length > 0 && (
          <>
            <div className="sec">
              <div className="sech"><h2>Recent</h2><a className="all" href={demoHref('projects')} onClick={linkClick('projects')}>All projects</a></div>
              <div className="filter" role="group" aria-label="Show">
                {([['all', 'All'], ['prog', 'In progress'], ['fin', 'Finished']] as const).map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="grid" id="grid">
              <a className="tile newtile" href={demoHref('upload')} onClick={e => { e.preventDefault(); go('upload'); }}>
                <div className="th"><span className="plus"><IconPlus /></span>Upload video<small>or drop a file anywhere</small></div>
              </a>
              {others.filter(shown).map(p => <Tile key={p.id} p={p} />)}
            </div>
          </>
        )}
      </main>
    </>
  );
}
