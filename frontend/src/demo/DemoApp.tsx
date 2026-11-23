import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { flushSync } from 'react-dom';
import './demo.css';
import { DemoProvider, useDemo } from './store';
import { PROJECT_SCREENS, hasScreenParam, screenFromUrl, tourFromUrl, type Screen, type ScreenProps } from './nav';
import { DemoUiContext, prefersReducedMotion, type DemoUi } from './ui';
import FirstRun from './screens/FirstRun';
import Home from './screens/Home';
import Upload from './screens/Upload';
import Detect from './screens/Detect';
import Colorize from './screens/Colorize';
import Mood from './screens/Mood';
import RenderScreen from './screens/Render';
import Results from './screens/Results';
import Projects from './screens/Projects';
import ProjectPage from './screens/ProjectPage';

/* MoodPlay web demo (/demo): a clickable replica of the v5 app on fake data.
   Screen = ?screen= + state. Screen swaps crossfade with the View Transitions API when available. */

const SCREENS: Record<Screen, ComponentType<ScreenProps>> = {
  intro: FirstRun, home: Home, upload: Upload, detect: Detect, colorize: Colorize, mood: Mood,
  render: RenderScreen, results: Results, projects: Projects, project: ProjectPage,
};
const TITLES: Record<Screen, string> = {
  intro: 'Welcome', home: 'Home', upload: 'Upload', detect: 'Detect', colorize: 'Colorize', mood: 'Mood',
  render: 'Rendering', results: 'Results', projects: 'Projects', project: 'Project',
};

interface Route { screen: Screen; id?: string; explicit: boolean }
const readRoute = (): Route => ({ ...screenFromUrl(location.search), explicit: hasScreenParam(location.search) });

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };

export default function DemoApp() {
  return (
    <DemoProvider>
      <Shell />
    </DemoProvider>
  );
}

function Shell() {
  const { state, dispatch, current } = useDemo();
  const [route, setRoute] = useState<Route>(readRoute);
  const [query, setQuery] = useState('');
  const first = useRef(true);

  // Browser back/forward and go() both arrive here as popstate.
  useEffect(() => {
    const onPop = () => {
      const next = readRoute();
      const apply = () => { setRoute(next); window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); };
      const doc = document as DocWithVT;
      if (doc.startViewTransition && !prefersReducedMotion() && document.visibilityState === 'visible') {
        try { doc.startViewTransition(() => flushSync(apply)); return; } catch { /* fall through */ }
      }
      apply();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // ?tour=n deep link starts the tour at that step (the tour itself is Task 7).
  useEffect(() => {
    const n = tourFromUrl(location.search);
    if (n) dispatch({ type: 'tour', step: n });
  }, [dispatch]);

  const showIntro = route.screen === 'intro' || (!route.explicit && !state.firstRunSeen);
  const screen: Screen = showIntro ? 'intro' : route.screen;

  // Deep link / refresh mid-flow: a step screen without a current project opens one (an in-progress one first).
  const needsProject = PROJECT_SCREENS.includes(screen) && !current;
  useEffect(() => {
    if (!needsProject) return;
    const pick = state.projects.find(p => !p.finished) ?? state.projects[0];
    if (pick) dispatch({ type: 'open', id: pick.id });
    else dispatch({ type: 'createSample' });
  }, [needsProject, state.projects, dispatch]);

  useEffect(() => { document.title = TITLES[screen] + ' · MoodPlay demo'; }, [screen]);

  // Move focus to the new screen's heading after a swap (not on first load).
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    const h = document.querySelector<HTMLElement>('.v5 main h1, .v5 main h2');
    if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }, [screen, route.id]);

  /* ---------- toast (Undo): 6 s with Undo, 3.5 s without; pauses while hovered or focused ---------- */
  const [toastState, setToast] = useState<{ msg: string; undo?: () => void; on: boolean; key: number }>({ msg: '', on: false, key: 0 });
  const timer = useRef<{ t?: number; left: number; start: number; held: number }>({ left: 0, start: 0, held: 0 });
  const arm = useCallback((ms: number) => {
    window.clearTimeout(timer.current.t);
    timer.current.left = ms; timer.current.start = Date.now();
    timer.current.t = window.setTimeout(() => setToast(s => ({ ...s, on: false, undo: undefined })), ms);
  }, []);
  const toast = useCallback((msg: string, undo?: () => void) => {
    timer.current.held = 0;
    setToast(s => ({ msg, undo, on: true, key: s.key + 1 }));
    arm(undo ? 6000 : 3500);
  }, [arm]);
  useEffect(() => () => window.clearTimeout(timer.current.t), []);
  const pause = () => {
    if (!toastState.on) return;
    if (++timer.current.held === 1) { window.clearTimeout(timer.current.t); timer.current.left -= Date.now() - timer.current.start; }
  };
  const resume = () => {
    if (!toastState.on) return;
    timer.current.held = Math.max(0, timer.current.held - 1);
    if (!timer.current.held) arm(Math.max(timer.current.left, 1500));
  };

  const ui: DemoUi = useMemo(() => ({ query, setQuery, toast }), [query, toast]);
  const Comp = SCREENS[screen];

  return (
    <DemoUiContext.Provider value={ui}>
      <div className="v5" data-screen={screen}>
        <span className="bloom p" aria-hidden="true" /><span className="bloom b" aria-hidden="true" />
        {needsProject ? null : <Comp key={screen === 'project' ? 'project' : screen} id={route.id} />}
        <div className={'toast' + (toastState.on ? ' on' : '')} role="status" aria-live="polite"
          onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={resume}>
          <span>{toastState.msg}</span>
          {toastState.undo && (
            <button className="btn" type="button" onClick={() => {
              const fn = toastState.undo; window.clearTimeout(timer.current.t);
              setToast(s => ({ ...s, on: false, undo: undefined })); fn?.();
            }}>Undo</button>
          )}
        </div>
      </div>
    </DemoUiContext.Provider>
  );
}
