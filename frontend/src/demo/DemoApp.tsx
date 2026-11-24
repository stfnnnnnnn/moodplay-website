import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { flushSync } from 'react-dom';
import './demo.css';
import { DemoProvider, useDemo, useDemoExtra } from './store';
import { PROJECT_SCREENS, hasScreenParam, screenFromUrl, type Screen, type ScreenProps } from './nav';
import { DemoUiContext, navFocus, prefersReducedMotion, type DemoUi } from './ui';
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
import { Tour } from './tour/Tour';
import { deepLinkStep } from './tour/steps';

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

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void> } };

/** Flow order of the step screens; the other screens (Home, Projects, a project, the intro) are hubs. */
/** Screens whose project thumbnails morph into each other (the project hero and the Home / Projects cards). */
const HUBS = new Set<Screen>(['home', 'projects', 'project']);
const FLOW: Partial<Record<Screen, number>> = { upload: 1, detect: 2, colorize: 3, mood: 4, render: 5, results: 6 };
/** fwd / back along the steps (content slides), rise to or from a hub (content lifts in). */
function vtDirection(from: Screen, to: Screen): 'fwd' | 'back' | 'rise' {
  const a = FLOW[from], b = FLOW[to];
  if (a == null || b == null || a === b) return 'rise';
  return b > a ? 'fwd' : 'back';
}

export default function DemoApp() {
  return (
    <DemoProvider>
      <Shell />
    </DemoProvider>
  );
}

function Shell() {
  const { state, dispatch, current } = useDemo();
  const { markFirstRunSeen } = useDemoExtra();
  const [route, setRoute] = useState<Route>(readRoute);
  const [query, setQuery] = useState('');
  const first = useRef(true);

  // Browser back/forward and go() both arrive here as popstate. The swap runs as a view transition whose
  // direction (html[data-vt], read by demo.css) comes from where the two screens sit in the flow.
  const shown = useRef<{ screen: Screen; id?: string }>({ screen: 'home' });
  useEffect(() => {
    let token = 0;
    const onPop = () => {
      const next = readRoute();
      const apply = () => { setRoute(next); window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); };
      const doc = document as DocWithVT;
      if (doc.startViewTransition && !prefersReducedMotion() && document.visibilityState === 'visible') {
        const root = document.documentElement, mine = ++token, from = shown.current;
        root.dataset.vt = vtDirection(from.screen, next.screen);
        // Between Home / Projects and a project page, the opened project's thumbnail grows into the hero (and back):
        // only that one element is named, only for this transition (old side now, new side after the update)
        const thumbId = HUBS.has(from.screen) && HUBS.has(next.screen)
          ? (next.screen === 'project' ? next.id : from.screen === 'project' ? from.id : undefined) : undefined;
        const pick = () => (thumbId ? document.querySelector<HTMLElement>(`.v5 [data-thumb="${CSS.escape(thumbId)}"]`) : null);
        const named: HTMLElement[] = [];
        const name = (el: HTMLElement | null) => { if (el) { el.style.viewTransitionName = 'mp-thumb'; named.push(el); } };
        const unname = () => { named.forEach(el => { el.style.viewTransitionName = ''; }); named.length = 0; };
        name(pick());
        const clear = () => { unname(); if (mine === token) delete root.dataset.vt; };
        try {
          const vt = doc.startViewTransition(() => {
            const had = named.length > 0;
            unname();
            flushSync(apply);
            if (had) name(pick());
          });
          // a newer transition skips this one: only the latest clears the attribute
          vt.finished.then(clear, clear);
          // a transition skipped by a newer one rejects ready (AbortError): expected, never logged
          vt.ready.catch(() => {});
          vt.updateCallbackDone.catch(() => {});
          return;
        } catch { clear(); /* fall through */ }
      }
      apply();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // ?tour=n deep link starts the tour at that step (1-26; with ?screen= set, at that screen's first step when n
  // belongs to another page). Without ?screen= the tour opens the step's screen itself, so the link skips the intro.
  useEffect(() => {
    const n = deepLinkStep(location.search);
    if (n) { dispatch({ type: 'tour', step: n }); markFirstRunSeen(); }
  }, [dispatch, markFirstRunSeen]);

  // a ?tour=n link skips the first-run intro from the first render (ruling R14), so the tour opens step n's screen
  const [tourLink] = useState(() => deepLinkStep(location.search) != null);
  const showIntro = route.screen === 'intro' || (!route.explicit && !state.firstRunSeen && !tourLink);
  const screen: Screen = showIntro ? 'intro' : route.screen;
  useEffect(() => { shown.current = { screen, id: route.id }; }, [screen, route.id]);

  // Deep link / refresh mid-flow: a step screen without a current project opens one (an in-progress one first).
  const needsProject = PROJECT_SCREENS.includes(screen) && !current;
  useEffect(() => {
    if (!needsProject) return;
    const pick = state.projects.find(p => !p.finished) ?? state.projects[0];
    if (pick) dispatch({ type: 'open', id: pick.id });
    else dispatch({ type: 'createSample' });
  }, [needsProject, state.projects, dispatch]);

  useEffect(() => { document.title = TITLES[screen] + ' · MoodPlay demo'; }, [screen]);

  // Move focus to the new screen's heading after a swap (not on first load). When the swap came from typing in the
  // top-bar search, focus stays in the (new) search field with the caret at the end, so typing carries on.
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    if (navFocus.search) {
      navFocus.search = false;
      const s = document.querySelector<HTMLInputElement>('.v5 .tsearch input');
      if (s) { s.focus({ preventScroll: true }); const end = s.value.length; s.setSelectionRange(end, end); return; }
    }
    const h = document.querySelector<HTMLElement>('.v5 main h1, .v5 main h2');
    if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }, [screen, route.id]);

  /* ---------- toast (Undo): 6 s with Undo, 3.5 s without; pauses while hovered or focused ---------- */
  const dropUndo = useCallback(() => dispatch({ type: 'undoDelete', forget: true }), [dispatch]);
  const [toastState, setToast] = useState<{ msg: string; undo?: () => void; on: boolean; key: number }>({ msg: '', on: false, key: 0 });
  const timer = useRef<{ t?: number; left: number; start: number; held: number }>({ left: 0, start: 0, held: 0 });
  // the store keeps a deleted item for Undo only while its toast shows: it is dropped when the toast runs out, or when
  // a toast without Undo replaces it (a new delete's toast comes with its own, fresh Undo)
  const arm = useCallback((ms: number) => {
    window.clearTimeout(timer.current.t);
    timer.current.left = ms; timer.current.start = Date.now();
    timer.current.t = window.setTimeout(() => { dropUndo(); setToast(s => ({ ...s, on: false, undo: undefined })); }, ms);
  }, [dropUndo]);
  const toast = useCallback((msg: string, undo?: () => void) => {
    timer.current.held = 0;
    if (!undo) dropUndo();
    setToast(s => ({ msg, undo, on: true, key: s.key + 1 }));
    arm(undo ? 6000 : 3500);
  }, [arm, dropUndo]);
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
        {needsProject ? null : <Tour screen={screen} />}
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
