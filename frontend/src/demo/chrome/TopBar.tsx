import type { ReactNode } from 'react';
import { useDemo, type Step } from '../store';
import { STEP_SCREENS, TOUR_FIRST, demoHref, go, linkClick, screenFromUrl } from '../nav';
import { navFocus, useDemoUi } from '../ui';
import { IconHelp, IconSearch, IconUpload } from './Icons';
import { StepRail } from './StepRail';

/* Top bar for every demo page (v5-home.html / v5-upload.html).
   kind="home": wordmark, nav (Home, Projects n), search, divider, Tutorial (ghost), Upload video (blue).
   kind="step": wordmark | step rail | Tutorial (+ `extra`, e.g. the Hold Space button on Colorize/Mood).
   Pink is never used in the top bar. */

function Wordmark() {
  return (
    <a className="wmk" href={demoHref('home')} onClick={linkClick('home')} aria-label="MoodPlay home">
      <span className="m">Mood</span><span className="p">Play</span>
    </a>
  );
}

function TutorialButton({ tourStep }: { tourStep: number }) {
  const { dispatch } = useDemo();
  return (
    <button className="btn btn-ghost tut" type="button" aria-label="Tutorial" onClick={() => dispatch({ type: 'tour', step: tourStep })}>
      <IconHelp /><span className="lbl">Tutorial</span>
    </button>
  );
}

type HomeProps = { kind: 'home'; active: 'home' | 'projects' | null; tourStep?: number };
type StepProps = { kind: 'step'; step: Step; reached: Step; extra?: ReactNode; tourStep?: number; lockPast?: boolean; nowNote?: string };

export function TopBar(props: HomeProps | StepProps) {
  const { state } = useDemo();
  const { query, setQuery } = useDemoUi();

  if (props.kind === 'step') {
    return (
      <header className="topbar step">
        <div className="tb-l"><Wordmark /></div>
        <StepRail now={props.step} reached={props.reached} lockPast={props.lockPast} nowNote={props.nowNote} />
        <div className="tb-r">
          <div className="tactions">
            <TutorialButton tourStep={props.tourStep ?? TOUR_FIRST[STEP_SCREENS[props.step - 1]]} />
            {props.extra}
          </div>
        </div>
      </header>
    );
  }

  const { active } = props;
  return (
    <header className="topbar">
      <Wordmark />
      <nav className="tnav" aria-label="Main">
        <a href={demoHref('home')} onClick={linkClick('home')} aria-current={active === 'home' ? 'page' : undefined}>Home</a>
        <a href={demoHref('projects')} onClick={linkClick('projects')} aria-current={active === 'projects' ? 'page' : undefined} data-tour="tut_nav_projects">
          Projects <span className="n">{state.projects.length}</span>
        </a>
      </nav>
      <span className="grow" />
      <div className="tactions">
        <label className="tsearch">
          <IconSearch />
          <input type="search" placeholder="Search projects" aria-label="Search projects by name or mood" autoComplete="off" maxLength={200} value={query}
            onChange={e => {
              setQuery(e.target.value);
              // typing on Home or a project page opens Projects once (keys typed during the swap must not push it
              // again), and the shell keeps focus in this field there (navFocus) so the whole query lands in it
              if (active !== 'projects' && screenFromUrl(location.search).screen !== 'projects') { navFocus.search = true; go('projects'); }
            }} />
        </label>
        <span className="div" aria-hidden="true" />
        <TutorialButton tourStep={props.tourStep ?? TOUR_FIRST[active ?? 'projects']} />
        <a className="btn btn-blue" href={demoHref('upload')} onClick={linkClick('upload')} data-tour="landing_btn">
          <IconUpload /><span>Upload<span className="lbl-long"> video</span></span>
        </a>
      </div>
    </header>
  );
}
