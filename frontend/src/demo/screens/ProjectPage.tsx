import { useEffect, useRef, useState } from 'react';
import './projects.css';
import { TopBar } from '../chrome/TopBar';
import { IconChev, IconDownload, IconDup, IconLeft, IconPen, IconPlay, IconTrash } from '../chrome/Icons';
import { MoodLine, MoreMenu, Name, Progress } from '../chrome/ProjectCard';
import { StepBars } from '../chrome/StepBars';
import { Scene } from '../scene';
import { LIMITS, STEP_NAMES, copyName, isColor, useDemo, useDemoExtra, type Project, type Render } from '../store';
import { STEP_SCREENS, TOUR_FIRST, demoHref, go, linkClick, type ScreenProps, type Screen } from '../nav';
import { clearFromGrid, pending, setPending, useDemoUi } from '../ui';
import { CROP, MOOD_LABEL, clock, day, mid, plural, renderLength, shownMood } from '../format';

/* Project page, version B (v5-projects-b.html): hero frame + summary and actions, object colours, renders
   (History merged in), plus the owner's right rail (~260px) listing every project; the current one is marked
   and clicking another switches the page. Below 1200px the rail moves under the page, below 768px it is a
   sideways strip. "Show in folder" is hidden in the web demo; downloads are available in the app only. */

const TASK: Record<Render['kind'], string> = { 'Colorize + mood': 't-cm', 'Colorize only': 't-c', 'Mood only': 't-m' };

export default function ProjectPage({ id }: ScreenProps) {
  const { state, dispatch } = useDemo();
  const p = state.projects.find(x => x.id === id) ?? null;
  const leaving = useRef(false);

  useEffect(() => {
    if (!p) { if (!leaving.current) go('projects', undefined, { replace: true }); return; }
    if (state.currentId !== p.id) dispatch({ type: 'open', id: p.id });
  }, [p, state.currentId, dispatch]);

  if (!p) return null;
  return (
    <>
      <TopBar kind="home" active={null} tourStep={TOUR_FIRST.project} />
      <main className="ppage">
        <div className="pp">
          <ProjectView key={p.id} p={p} onLeave={() => { leaving.current = true; }} />
          <Rail current={p} projects={state.projects} />
        </div>
      </main>
    </>
  );
}

function goBack() {
  if (pending.fromGrid) { clearFromGrid(); history.back(); }
  else go('projects');
}

function ProjectView({ p, onLeave }: { p: Project; onLeave: () => void }) {
  const { dispatch } = useDemo();
  const { duplicate, openRender } = useDemoExtra();
  const { toast } = useDemoUi();
  const [initial] = useState(() => (pending.id === p.id ? pending.act : null));
  const [renaming, setRenaming] = useState(initial === 'rename');
  const [draft, setDraft] = useState(p.name);
  const [asking, setAsking] = useState(initial === 'delete');
  const [openRuns, setOpenRuns] = useState<Set<string>>(() => new Set(p.renders[0] ? [p.renders[0].id] : []));
  const [askRun, setAskRun] = useState<string | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [live, setLive] = useState('');
  const nameRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const goneT = useRef<number | undefined>(undefined);

  useEffect(() => { setPending(null, null); }, []);
  useEffect(() => () => window.clearTimeout(goneT.current), []);
  useEffect(() => { if (renaming) { inputRef.current?.focus(); inputRef.current?.select(); } }, [renaming]);
  useEffect(() => { if (asking) keepRef.current?.focus(); }, [asking]);

  // Escape peels back one layer: rename, confirm, then the page itself (like browser back). Menus handle their own.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (renaming) { setRenaming(false); setDraft(p.name); requestAnimationFrame(() => nameRef.current?.focus()); return; }
      if (asking) { setAsking(false); return; }
      if (askRun) { setAskRun(null); return; }
      const t = e.target as HTMLElement | null;
      if (t && /INPUT|SELECT|TEXTAREA/.test(t.tagName)) return;
      if (document.querySelector('.v5 .tour-card')) return;
      goBack();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [renaming, asking, askRun, p.name]);

  // reopens the project with this render's colours and mood (the render's snapshot), at the chosen step
  const openAt = (r: Render, screen: Screen) => { openRender(p.id, r.id); go(screen); };
  const saveName = () => {
    const v = draft.trim();
    if (v && v !== p.name) { dispatch({ type: 'rename', id: p.id, name: v }); setLive('Renamed to ' + v + '.'); }
    setRenaming(false);
    requestAnimationFrame(() => nameRef.current?.focus());
  };
  const dup = () => {
    const newId = duplicate(p.id);
    go('project', { id: newId }, { replace: true });
    toast('Duplicated. Pick a new mood for ' + mid(copyName(p.name), 40) + '.');
  };
  const del = () => {
    onLeave();
    dispatch({ type: 'deleteProject', id: p.id });
    clearFromGrid();
    go('projects', undefined, { replace: true });
    toast('Project deleted', () => dispatch({ type: 'undoDelete' }));
  };
  const delRun = (r: Render) => {
    setGone(r.id);
    goneT.current = window.setTimeout(() => {
      const i = p.renders.indexOf(r);
      dispatch({ type: 'deleteRender', projectId: p.id, renderId: r.id });
      setGone(null); setAskRun(null);
      toast('Render deleted', () => dispatch({ type: 'undoDelete' }));
      requestAnimationFrame(() => {
        const btns = document.querySelectorAll<HTMLButtonElement>('.v5 .ppage .rexp');
        (btns[Math.min(i, btns.length - 1)] ?? nameRef.current)?.focus();
      });
    }, 200);
  };
  const toggleRun = (rid: string) => setOpenRuns(s => { const n = new Set(s); if (n.has(rid)) n.delete(rid); else n.add(rid); return n; });

  const nColored = p.objects.filter(o => isColor(o.color)).length;
  const contTarget: Screen = p.finished ? 'results' : STEP_SCREENS[p.step - 1];

  return (
    <div className="pmain">
      <div className="crumbs">
        <button className="back" type="button" onClick={goBack}><IconLeft />All projects</button>
        <nav aria-label="Breadcrumb"><ol className="bc">
          <li><a href={demoHref('projects')} onClick={e => { if (e.button === 0 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); goBack(); } }}>Projects</a></li>
          <li><span aria-current="page" title={p.name}>{mid(p.name, 60)}</span></li>
        </ol></nav>
        <span className="esc">Press <span className="kbd">Esc</span> to go back</span>
      </div>

      <div className="hero">
        <div className="hframe" data-thumb={p.id}>
          <Scene variant="gray" objects={p.objects} mood={shownMood(p)} viewBox={CROP} videoSrc={p.videoSrc} />
          <span className={'badge ' + (p.finished ? 'fin' : 'wip')}>{p.finished ? 'Finished' : 'In progress'}</span>
        </div>
        <div className="sum d-rest">
          {!renaming && (
            <div className="sum-name">
              <h1 id="d-name" tabIndex={-1} ref={nameRef} title={p.name}>{p.name}</h1>
              <button className="icon-btn" type="button" aria-label="Rename project" onClick={() => { setDraft(p.name); setRenaming(true); }}><IconPen /></button>
            </div>
          )}
          {renaming && (
            <div className="rename">
              <input ref={inputRef} aria-label="Project name" maxLength={LIMITS.name} value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); }} />
              <button className="btn btn-blue" type="button" onClick={saveName}>Save</button>
              <button className="btn btn-ghost" type="button" onClick={() => { setRenaming(false); setDraft(p.name); requestAnimationFrame(() => nameRef.current?.focus()); }}>Cancel</button>
            </div>
          )}
          <div className="facts1">
            <div className="md"><MoodLine p={p} /></div>
            <div className="dt"><Progress p={p} long /></div>
            <div className="rn">{p.renders.length ? plural(p.renders.length, 'render', 'renders') : 'No renders yet'}</div>
          </div>
          <div className="cta">
            <a className="btn btn-pink" href={demoHref(contTarget)} onClick={linkClick(contTarget, undefined, () => dispatch({ type: 'open', id: p.id }))}>
              {p.finished ? 'Open results' : 'Continue at ' + STEP_NAMES[p.step - 1]}
            </a>
            <div className="sec-acts">
              <button className="btn btn-ghost" type="button" onClick={dup}><IconDup />Duplicate with another mood</button>
              <div className="more-wrap">
                <MoreMenu className="btn btn-ghost more" label="More project actions" items={[
                  { key: 'rename', label: 'Rename', onSelect: () => { setDraft(p.name); setRenaming(true); } },
                  { key: 'delete', label: 'Delete project', danger: true, sep: true, onSelect: () => setAsking(true) },
                ]} />
              </div>
            </div>
          </div>
          <div className={'ask' + (asking ? ' on' : '')} role="group" aria-label="Confirm delete project" hidden={!asking}>
            <p>Delete {mid(p.name, 40)}?<span>The project and its {plural(p.renders.length, 'render', 'renders')} are removed. The source video stays where it is.</span></p>
            <div className="btns">
              <button className="btn btn-danger" type="button" onClick={del}>Delete project</button>
              <button className="btn btn-ghost" type="button" ref={keepRef} onClick={() => setAsking(false)}>Keep project</button>
            </div>
          </div>
        </div>
      </div>

      <section className="blk d-rest" aria-labelledby="oc-h">
        <div className="blk-h"><h2 id="oc-h">Object colors</h2><span>{nColored} of {p.objects.length} colored</span></div>
        <ul className="chips">
          {p.objects.map(o => {
            const c = isColor(o.color) ? o.color : null;
            return (
              <li className="ochip" key={o.id}>
                <span className="obj">{o.id}</span>
                <span className={'sw' + (c ? '' : ' none')} style={c ? { background: c } : undefined} />
                <div><b title={o.label}>{o.label}</b><small>{c ?? (o.color === 'retain' ? 'Keeps its original color' : 'Not colored yet')}</small></div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="blk d-rest" aria-labelledby="rn-h">
        <div className="blk-h"><h2 id="rn-h">Renders</h2><span>{p.renders.length ? plural(p.renders.length, 'render', 'renders') + ', newest first' : ''}</span></div>
        {p.renders.length ? (
          <div className="rlist" data-tour="tut_project_runs">
            <div className="rcols" aria-hidden="true"><span>Preview</span><span>Rendered</span><span>Task</span><span>Mood</span><span>Frames</span><span>Objects</span><span>Video</span><span /></div>
            {p.renders.map(r => (
              <RunRow key={r.id} p={p} r={r} open={openRuns.has(r.id)} asking={askRun === r.id} gone={gone === r.id}
                onToggle={() => toggleRun(r.id)} onAsk={() => setAskRun(r.id)} onKeep={() => setAskRun(null)} onDelete={() => delRun(r)} onOpenAt={s => openAt(r, s)}
                onPlay={() => toast('Playback is in the MoodPlay app. The web demo shows a still frame.')} />
            ))}
          </div>
        ) : (
          <div className="norun" data-tour="tut_project_runs"><b>No renders yet</b>Renders show up here after you choose Render video on the Mood step. Each one is kept with its colors and mood, so you can download it again or reopen it later.</div>
        )}
      </section>
      <div className="sr" aria-live="polite">{live}</div>
    </div>
  );
}

function RunRow({ p, r, open, asking, gone, onToggle, onAsk, onKeep, onDelete, onOpenAt, onPlay }: {
  p: Project; r: Render; open: boolean; asking: boolean; gone: boolean;
  onToggle: () => void; onAsk: () => void; onKeep: () => void; onDelete: () => void; onOpenAt: (s: Screen) => void; onPlay: () => void;
}) {
  const noBtn = useRef<HTMLButtonElement>(null);
  const delBtn = useRef<HTMLButtonElement>(null);
  const was = useRef(asking);
  useEffect(() => {
    if (asking) noBtn.current?.focus();
    else if (was.current) delBtn.current?.focus();
    was.current = asking;
  }, [asking]);
  const mood = r.mood !== 'none' ? MOOD_LABEL[r.mood] : null;
  const len = renderLength(r.frames);
  const rb = 'rb-' + r.id;
  const objects = r.scene ?? p.objects; // the colours this render was made with
  return (
    <article className={'run' + (open ? ' open' : '') + (gone ? ' gone' : '')} aria-label={`Render from ${day(r.at)}, ${clock(r.at)}`}>
      <div className="rrow">
        <span className="rth"><Scene variant="gray" objects={objects} mood={r.mood} viewBox={CROP} /></span>
        <span className="rwhen"><b>{day(r.at)}, {clock(r.at)}</b><span>{len}</span></span>
        <span className="rtask"><span className={'chip ' + TASK[r.kind]}>{r.kind}</span></span>
        <span className={'rc mo' + (mood ? '' : ' none')}><small aria-hidden="true">Mood</small><span className="sr">Mood: </span><span className="v">{mood ?? 'None'}</span></span>
        <span className="rc fm"><small aria-hidden="true">Frames</small><span className="sr">Frames colorized: </span><span className="v">{r.frames.toLocaleString('en-US')}</span></span>
        <span className={'rc ob' + (r.objects ? '' : ' none')}><small aria-hidden="true">Objects</small><span className="sr">Objects recolored: </span><span className="v">{r.objects || 'None'}</span></span>
        <span className="rdl">
          <button className="btn btn-line" type="button" disabled aria-describedby={'dln-' + r.id}><IconDownload />Download</button>
          <span className="note" id={'dln-' + r.id}>Available in the app</span>
        </span>
        <button className="rexp" type="button" aria-expanded={open} aria-controls={rb} aria-label={(open ? 'Hide' : 'Show') + ' preview and steps'} onClick={onToggle}><IconChev /></button>
      </div>
      <div className="rbody" id={rb} inert={!open}>
        <div className="rin"><div className="rgrid">
          <div className="pv">
            <Scene variant="gray" objects={objects} mood={r.mood} viewBox={CROP} videoSrc={r.videoSrc} />
            <button className="play" type="button" aria-label="Play this render" onClick={onPlay}><IconPlay /></button>
            <span className="chip dur">{len}</span>
          </div>
          <div className="ostep">
            <h3>Open at step</h3>
            <p>Reopens the project with this render’s colors and mood.</p>
            <div className="obtns" role="group" aria-label="Open this render at a step">
              {STEP_NAMES.map((s, k) => (
                <a key={s} className="btn btn-ghost" href={demoHref(STEP_SCREENS[k])} aria-label={'Open this render at ' + s}
                  onClick={e => { if (e.button === 0 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); onOpenAt(STEP_SCREENS[k]); } }}>{s}</a>
              ))}
            </div>
            <div className={'rfoot' + (asking ? ' asking' : '')}>
              <button className="btn btn-quiet rdel" type="button" ref={delBtn} onClick={onAsk}><IconTrash />Delete render</button>
              <div className="ask" role="group" aria-label="Confirm delete render">
                <p>Delete this render?<span>Its output video is removed. The project and source video stay.</span></p>
                <div className="btns">
                  <button className="btn btn-danger" type="button" onClick={onDelete}>Delete render</button>
                  <button className="btn btn-ghost" type="button" ref={noBtn} onClick={onKeep}>Keep render</button>
                </div>
              </div>
            </div>
          </div>
        </div></div>
      </div>
    </article>
  );
}

function Rail({ current, projects }: { current: Project; projects: Project[] }) {
  return (
    <aside className="prail" aria-labelledby="rail-h">
      <h2 id="rail-h">Your projects <span className="n">{projects.length}</span></h2>
      <ul>
        {projects.map(q => {
          const cur = q.id === current.id;
          return (
            <li key={q.id}>
              <a className="ri" href={demoHref('project', { id: q.id })} aria-current={cur ? 'page' : undefined}
                onClick={cur ? e => e.preventDefault() : linkClick('project', { id: q.id }, clearFromGrid)}>
                <span className="rt" data-thumb={cur ? undefined : q.id}>
                  <Scene variant="gray" objects={q.objects} mood={shownMood(q)} viewBox={CROP} />
                </span>
                <span className="rx">
                  <b title={q.name}><Name name={q.name} n={34} /></b>
                  <span className="rs">
                    <span className={q.finished ? 'fin' : 'wip'}>{q.finished ? 'Finished' : 'In progress'}</span>
                    <StepBars project={q} />
                  </span>
                  <span className="now">Open now</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
