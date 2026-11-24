import { useEffect, type MouseEvent, type ReactNode } from 'react';
import { useDemo, type Step } from '../store';
import { STEP_SCREENS, TOUR_FIRST, backTarget, demoHref, go, goTo, linkClick, screenFromUrl, type Entry, type Screen } from '../nav';
import { navFocus, useDemoUi } from '../ui';
import { IconHelp, IconHome, IconLeft, IconSearch, IconUpload } from './Icons';
import { StepRail } from './StepRail';

/* Top bar for every demo page (v5-home.html / v5-upload.html).
   kind="home": wordmark, nav (Home, Projects n), search, divider, Tutorial (ghost), Upload video (blue).
   kind="step": wordmark, Home, Back | step rail | `extra` (the Hold Space button on Colorize/Mood). No Tutorial on the
   step pages (owner, B1 fix round 1): the tour starts from Home, Projects and a project page.
   Back goes to the previous step (nav.ts backTarget), through real history when that is the previous entry.
   `onLeave` lets a page ask first before Home, Back or the wordmark leave it (Render's stop confirm mid-run).
   Pink is never used in the top bar. */

/** A page's guard for leaving through the top bar: return true to hold the navigation; call `go` to finish it. */
export type LeaveGuard = (go: () => void) => boolean;

const plain = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
/** Click handler for a top-bar link: plain clicks run `nav` in-app (asking the page first), modified clicks keep browser behaviour. */
const leaveClick = (nav: () => void, onLeave?: LeaveGuard) => (e: MouseEvent) => {
  if (!plain(e)) return;
  e.preventDefault();
  if (!onLeave?.(nav)) nav();
};
const goHome = () => go('home');

function Wordmark({ onLeave }: { onLeave?: LeaveGuard }) {
  return (
    <a className="wmk" href={demoHref('home')} onClick={onLeave ? leaveClick(goHome, onLeave) : linkClick('home')} aria-label="MoodPlay home">
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
type StepProps = {
  kind: 'step'; step: Step; reached: Step; extra?: ReactNode; lockPast?: boolean; nowNote?: string;
  /** the screen when it is not the step's own (Render shares step 5 with Results) */
  screen?: Screen; onLeave?: LeaveGuard;
};

/** Home and Back on the step pages (task B1): 44px icon-only buttons at every width (owner, fix round 1). Their names
 *  ("Home", "Back to …") are the aria-labels and show as a tooltip after a short hover or on keyboard focus. */
function StepNav({ screen, onLeave }: { screen: Screen; onLeave?: LeaveGuard }) {
  const { state, current } = useDemo();
  // Escape hides a showing tooltip (WCAG 1.4.13: dismissible without moving pointer or focus). It only marks the
  // icon (data-tipoff) and never stops the key, so the page's own Escape handlers run as before.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll<HTMLElement>('.v5 .tb-ico').forEach(el => {
        if (el === document.activeElement || el.matches(':hover')) el.dataset.tipoff = '';
      });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const tipBack = (e: { currentTarget: HTMLElement }) => { delete e.currentTarget.dataset.tipoff; };
  const back = backTarget(screen, current?.id);
  const to: Entry = back.id ? { screen: back.screen, id: back.id } : { screen: back.screen };
  // a project page is named by its file name, like every other Back names its step
  const where = back.screen === 'project' ? state.projects.find(p => p.id === back.id)?.name ?? back.label : back.label;
  return (
    <>
      <a className="tb-ico tb-home" href={demoHref('home')} onClick={leaveClick(goHome, onLeave)} aria-label="Home" data-tip="Home"
        onMouseLeave={tipBack} onBlur={tipBack}>
        <IconHome size={20} />
      </a>
      <a className="tb-ico tb-back" href={demoHref(to.screen, to.id ? { id: to.id } : undefined)} onClick={leaveClick(() => goTo(to), onLeave)}
        aria-label={'Back to ' + where} data-tip={'Back to ' + where} onMouseLeave={tipBack} onBlur={tipBack}>
        <IconLeft size={20} />
      </a>
    </>
  );
}

export function TopBar(props: HomeProps | StepProps) {
  const { state } = useDemo();
  const { query, setQuery } = useDemoUi();

  if (props.kind === 'step') {
    return (
      <header className="topbar step">
        <div className="tb-l"><Wordmark onLeave={props.onLeave} /><StepNav screen={props.screen ?? STEP_SCREENS[props.step - 1]} onLeave={props.onLeave} /></div>
        <StepRail now={props.step} reached={props.reached} lockPast={props.lockPast} nowNote={props.nowNote} />
        <div className="tb-r">
          {props.extra && <div className="tactions">{props.extra}</div>}
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
