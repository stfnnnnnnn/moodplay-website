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

/** First tour step of each page (tutorial-v5.md). The Tutorial buttons (Home, Projects, a project page) start there; the
 *  step-page entries stay for completeness (the step pages have no Tutorial button since B1 fix round 1). */
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

/** True when the URL asks for the first-run intro (?intro=1, the landing's "Try the demo" link). Any other value is
 *  ignored. The intro then plays even when it was already seen this session (task C). */
export function introFromUrl(search: string): boolean {
  return new URLSearchParams(search).get('intro') === '1';
}

/** The same query without its intro marker (whatever its value), so a reload or Back does not replay the intro. */
export function withoutIntro(search: string): string {
  const q = new URLSearchParams(search);
  if (!q.has('intro')) return search;
  q.delete('intro');
  const s = q.toString();
  return s ? '?' + s : '';
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

/** A demo history entry: a screen and, for a project page or a project's own Upload, its id. */
export interface Entry { screen: Screen; id?: string }

/** The demo entry the current history entry was opened from (go() records it), or null on a fresh load. */
export function fromEntry(): Entry | null {
  const f = (history.state as { from?: Entry } | null)?.from;
  return f && isScreen(f.screen) ? f : null;
}

export function go(screen: Screen, params?: { id?: string; tour?: number }, opts?: { replace?: boolean }): void {
  const href = demoHref(screen, params);
  // remember where this entry was opened from, so a step page's Back can use real history (a replace keeps it)
  const from: Entry | undefined = opts?.replace ? fromEntry() ?? undefined : screenFromUrl(location.search);
  const state = { screen, ...params, from };
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

/** Where a step page's Back goes (task B1): the previous step in the flow. Upload and Results go back to the
 *  project page when they were opened from it; Upload otherwise goes Home. Detect goes back to the project's own
 *  clip (Upload with ?id=, as the step rail does). */
export function backTarget(screen: Screen, projectId?: string): Entry & { label: string } {
  const f = fromEntry();
  const fromProject = f?.screen === 'project' && !!f.id;
  switch (screen) {
    case 'upload': return fromProject ? { screen: 'project', id: f!.id, label: 'project' } : { screen: 'home', label: 'Home' };
    case 'detect': return { screen: 'upload', id: projectId, label: 'Upload' };
    case 'colorize': return { screen: 'detect', label: 'Detect' };
    case 'mood': return { screen: 'colorize', label: 'Colorize' };
    case 'render': return { screen: 'mood', label: 'Mood' };
    case 'results': return fromProject ? { screen: 'project', id: f!.id, label: 'project' } : { screen: 'mood', label: 'Mood' };
    default: return { screen: 'home', label: 'Home' };
  }
}

/** Go to `to`: back in history when the previous entry is that same demo screen (keeps the history short and
 *  restores it as it was), else a new entry. */
export function goTo(to: Entry): void {
  const f = fromEntry();
  if (f && f.screen === to.screen && (f.id ?? null) === (to.id ?? null)) history.back();
  else go(to.screen, to.id ? { id: to.id } : undefined);
}
