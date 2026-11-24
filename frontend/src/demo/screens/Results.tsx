import './steps.css';
import './results.css';
import { TopBar } from '../chrome/TopBar';
import { Scene } from '../scene';
import { isColor, shownRenderOf, useDemo, type SceneObject } from '../store';
import { demoHref, go, linkClick } from '../nav';
import { CLIP, CLIP_SIZE, CROP, MOOD_LABEL, MOOD_PAL, mid, realMood } from '../format';
import { EmptyStep } from '../parts/EmptyStep';
import { reachedFor } from '../parts/flow';
import { SyncedPlayers } from '../parts/SyncedPlayers';

/* Results (v5-results.html + owner round 3): the original and colorized video on one playhead (SyncedPlayers),
   and the summary card titled by the file name: one Change for the object colours, one for the mood, then the
   downloads. No pills above the video, no clip length, no "applied to the whole clip" subtext.
   The demo cannot make a real file, so "Download video (MP4)" stays the page's one pink button but is
   disabled with "Available in the app" (the same for "Object colors only"). */

const DL = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></svg>;

function ColorValue({ o }: { o: SceneObject }) {
  if (isColor(o.color)) return <><span className="sw" style={{ background: o.color }} /><span className="val">{o.color.toUpperCase()}</span></>;
  if (o.color === 'retain') return <><span className="sw keep" /><span className="val">Keep original</span></>;
  return <><span className="sw none" /><span className="val">No color</span></>;
}

export default function Results() {
  const { current } = useDemo();
  // Safety net only: DemoApp opens or creates a project before any step screen renders (needsProject), so this is not normally reached.
  if (!current) {
    return <EmptyStep step={5} title="No project open" text="Open a finished project to see its results." to="projects" action="Go to Projects" />;
  }
  const last = shownRenderOf(current); // the newest render, or the one reopened with "Open at step"
  if (!last && !current.finished) {
    return <EmptyStep step={5} reached={reachedFor(current, 4)} title="Nothing rendered yet"
      text="Choose a mood and render the video. Its results open here when it finishes." to="mood" action="Back to Mood" />;
  }
  // colours and mood both come from the last render's snapshot (what was rendered), not the project's later edits
  const mood = realMood(last ? last.mood : current.mood);
  const moodName = mood ? MOOD_LABEL[mood] : null;
  const objects = last?.scene ?? current.objects;

  return (
    <>
      <TopBar kind="step" step={5} reached={5} />
      <main className="sp sp-results">
        <h1 className="sr">Results</h1>
        <section className="sp-stage rs-work" aria-label="Compare original and colorized video">
          <SyncedPlayers objects={objects} mood={mood} moodName={moodName} originalSrc={current.videoSrc} colorSrc={last?.videoSrc} />
        </section>

        <aside className="sp-panel card recipe" aria-labelledby="rh">
          <header>
            <h2 id="rh" title={current.name.length > 60 ? current.name : undefined} aria-label={current.name}>{mid(current.name, 60)}</h2>
            <p>{CLIP_SIZE}, {CLIP.fps} fps</p>
          </header>

          <section className="sec" aria-labelledby="oh" data-tour="results_summary">
            <div className="sec-h"><h3 id="oh">Objects</h3>
              <a className="chg" href={demoHref('colorize')} onClick={linkClick('colorize')} aria-label="Change object colors">Change</a></div>
            <ul className="rows">
              {objects.map(o => (
                <li key={o.id} className="row"><span className="obj">{o.id}</span><span className="nm" title={o.label}>{o.label}</span><ColorValue o={o} /></li>
              ))}
            </ul>
          </section>

          <section className="sec" aria-labelledby="mh" data-tour="results_summary">
            <div className="sec-h"><h3 id="mh">Mood</h3>
              <a className="chg" href={demoHref('mood')} onClick={linkClick('mood')} aria-label="Change mood">Change</a></div>
            <ul className="rows">
              <li className="row">
                <span className="mthumb" aria-hidden="true"><Scene variant="color" objects={objects} mood={mood} viewBox={CROP} /></span>
                <span className="nm">{moodName ?? 'No mood'}</span>
                {mood && <span className="dots" aria-hidden="true">{MOOD_PAL[mood].map(c => <i key={c} style={{ background: c }} />)}</span>}
              </li>
            </ul>
          </section>

          <div className="out">
            <button className="btn btn-pink btn-lg" type="button" id="dl" aria-disabled="true" aria-describedby="dlNote" data-tour="btn_download"
              onClick={e => e.preventDefault()}>
              {DL}Download video (MP4)
            </button>
            <p className="dlnote" id="dlNote">Available in the app</p>
            <div className="alt">
              {mood && (
                <>
                  <button className="btn btn-quiet two" type="button" data-dl aria-disabled="true" aria-describedby="dlNote" data-tour="btn_download"
                    onClick={e => e.preventDefault()}>
                    {DL}<span className="lbl">Object colors only<small>MP4 without the mood</small></span>
                  </button>
                  <hr />
                </>
              )}
              <button className="btn btn-quiet" type="button" onClick={() => go('upload')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                Start a new video
              </button>
            </div>
          </div>
        </aside>
      </main>
    </>
  );
}
