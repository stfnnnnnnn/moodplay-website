/* Demo routing: ?screen=<name>&id=<project>&tour=<n> on the /demo path. No router library.
   go() pushes a history entry and fires a popstate event, so one listener (DemoApp) handles
   both in-app navigation and the browser's back/forward buttons. */

export type Screen = 'intro' | 'home' | 'upload' | 'detect' | 'colorize' | 'mood' | 'render' | 'results' | 'projects' | 'project';

/** Props every screen component receives from DemoApp (id = ?id= from the URL). */
export interface ScreenProps { id?: string }

export const SCREENS: readonly Screen[] = ['intro', 'home', 'upload', 'detect', 'colorize', 'mood', 'render', 'results', 'projects', 'project'];
/** Step n (1-5) -> its screen. */
export const STEP_SCREENS = ['upload', 'detect', 'colorize', 'mood', 'results'] as const satisfies readonly Screen[];
/** Screens that belong to one project (need a current project). */
export const PROJECT_SCREENS: readonly Screen[] = ['upload', 'detect', 'colorize', 'mood', 'render', 'results'];

/** First tour step of each page (tutorial-v5.md), used by the Tutorial buttons. */
export const TOUR_FIRST: Record<Screen, number> = { intro: 1, home: 1, upload: 4, detect: 8, colorize: 12, mood: 16, render: 19, results: 21, projects: 24, project: 25 };

const isScreen =(s: string | null): s is Screen => !!s && (SCREENS as readonly string[]).includes(s);

/** Unknown or missing screen -> 'home'. */
export function screenFromUrl(search: string): { screen: Screen; id?: string } {
  const q = new URLSearchParams(search);
  const s = q.get('screen');
  const screen: Screen = isScreen(s) ? s : 'home';
  const id = q.get('id') || undefined;
  return id ? { screen, id } : { screen };
}

/** True when the URL names a screen explicitly (a deep link), so the first-run intro is skipped. */
export function hasScreenParam(search: string): boolean {
  return isScreen(new URLSearchParams(search).get('screen'));
}

/** Number of tour steps (tutorial-v5.md). */
export const TOUR_STEPS = 26;

/** 1-based tour step from ?tour=n (1-26), or null. */
export function tourFromUrl(search: string): number | null {
  const n = Number(new URLSearchParams(search).get('tour'));
  return Number.isInteger(n) && n >= 1 ? Math.min(n, TOUR_STEPS) : null; // clamped to the tour's 26 steps
}

function basePath(): string {
  const p = typeof location !== 'undefined' ? location.pathname : '/demo';
  return /\/demo\/?$/.test(p) ? p : '/demo';
}

export function demoHref(screen: Screen, params?: { id?: string; tour?: number }): string {
  const q = new URLSearchParams({ screen });
  if (params?.id) q.set('id', params.id);
  if (params?.tour) q.set('tour', String(params.tour));
  return basePath() + '?' + q.toString();
}

export function go(screen: Screen, params?: { id?: string; tour?: number }, opts?: { replace?: boolean }): void {
  const href = demoHref(screen, params);
  const state = { screen, ...params };
  if (opts?.replace) history.replaceState(state, '', href);
  else history.pushState(state, '', href);
  window.dispatchEvent(new PopStateEvent('popstate', { state }));
}

/** Click handler for <a href={demoHref(...)}>: plain clicks navigate in-app, modified clicks keep browser behaviour. */
export function linkClick(screen: Screen, params?: { id?: string; tour?: number }, before?: () => void) {
  return (e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; preventDefault: () => void }) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    before?.();
    go(screen, params);
  };
}
