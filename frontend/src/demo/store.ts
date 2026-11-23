import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';

/* ---------- Types (fixed interface, see docs/superpowers/plans/2026-11-23-v5-web-demo.md) ---------- */
export type Step = 1 | 2 | 3 | 4 | 5;                       // Upload, Detect, Colorize, Mood, Results
export type MoodKey = 'none' | 'tokyo' | 'sunny' | 'blues';  // same keys as landing/data.ts MOODS
/** box = [x0, y0, x1, y1] in the scene's 2100×900 viewBox. */
export interface SceneObject { id: number; label: string; color: string | 'retain' | null; box: [number, number, number, number] }
export interface Render { id: string; at: string; kind: 'Colorize + mood' | 'Colorize only' | 'Mood only'; mood: MoodKey; frames: number; objects: number; videoSrc?: string }
export interface Project { id: string; name: string; step: Step; finished: boolean; updated: string; mood: MoodKey | null; objects: SceneObject[]; renders: Render[]; isSample?: boolean; videoSrc?: string }
export interface DemoState { projects: Project[]; currentId: string | null; recentColors: string[]; firstRunSeen: boolean; tour: { active: boolean; step: number } | null }
export type Action =
  | { type: 'open'; id: string } | { type: 'setStep'; step: Step } | { type: 'setColor'; objectId: number; color: string | 'retain' }
  | { type: 'setMood'; mood: MoodKey | null } | { type: 'finishRender' } | { type: 'createSample' } | { type: 'upload'; name: string }
  | { type: 'rename'; id: string; name: string } | { type: 'deleteRender'; projectId: string; renderId: string } | { type: 'undoDelete' }
  | { type: 'deleteProject'; id: string } | { type: 'tour'; step: number | null };

/* Internal actions (not part of the public interface). */
type InternalAction =
  | { type: '_restore'; projects: Project[]; currentId: string | null }
  | { type: '_duplicate'; id: string; newId: string }
  | { type: '_seen' };

/* ---------- Sample data (v5-home.html / v5-projects-b.html) ---------- */
export const STEP_NAMES = ['Upload', 'Detect', 'Colorize', 'Mood', 'Results'] as const;
export const SAMPLE_COLORS = ['#C8326B', '#2A9C9C', '#E39B2D', '#2F6FD6', '#3E9B5C'];
const OBJECT_DEFS: { label: string; box: [number, number, number, number] }[] = [
  { label: 'Person 1', box: [340, 374, 540, 840] },
  { label: 'Shopfront', box: [580, 230, 880, 550] },
  { label: 'Car', box: [820, 540, 1340, 812] },
  { label: 'Person 2', box: [1515, 346, 1705, 838] },
  // top edge matches the mockups' label position (40%) rather than the head (424)
  { label: 'Person 3', box: [1794, 360, 1946, 834] },
];
export const makeObjects = (colors: (string | 'retain' | null)[]): SceneObject[] =>
  OBJECT_DEFS.map((d, i) => ({ id: i + 1, label: d.label, color: colors[i] ?? null, box: [...d.box] as [number, number, number, number] }));

const H = 3600e3, D = 24 * H;
const T0 = Date.now();
const ago = (ms: number) => new Date(T0 - ms).toISOString();
const run = (id: string, msAgo: number, kind: Render['kind'], mood: MoodKey, frames: number, objects: number): Render =>
  ({ id, at: ago(msAgo), kind, mood, frames, objects });

export const SAMPLE_PROJECTS: Project[] = [
  { id: 'p2', name: 'old_film_bw.avi', step: 3, finished: false, updated: ago(26 * H), mood: null,
    objects: makeObjects([SAMPLE_COLORS[0], SAMPLE_COLORS[1], null, null, null]), renders: [] },
  { id: 'p1', name: 'family_walk.mov', step: 5, finished: true, updated: ago(.3 * H), mood: 'blues',
    objects: makeObjects(SAMPLE_COLORS),
    renders: [run('r13', .5 * H, 'Colorize + mood', 'blues', 30, 5), run('r12', 5.4 * H, 'Colorize only', 'none', 30, 5), run('r11', 22 * H, 'Mood only', 'sunny', 30, 0)] },
  { id: 'p3', name: 'campus_night.mp4', step: 5, finished: true, updated: ago(4 * D), mood: 'tokyo',
    objects: makeObjects([...SAMPLE_COLORS.slice(0, 4), null]),
    renders: [run('r9', 4 * D, 'Colorize + mood', 'tokyo', 30, 4)] },
  { id: 'p4', name: 'grandparents_wedding_1962.mov', step: 2, finished: false, updated: ago(5 * D), mood: null,
    objects: makeObjects([null, null, null, null, null]), renders: [] },
];
export const SAMPLE_NAME = 'sample_family_walk.mov';

export const initialState: DemoState = {
  projects: SAMPLE_PROJECTS,
  currentId: 'p2',
  recentColors: SAMPLE_COLORS.slice(),
  firstRunSeen: false,
  tour: null,
};

/* ---------- Reducer ---------- */
const now = () => new Date().toISOString();
const colored = (p: Project) => p.objects.filter(o => o.color && o.color !== 'retain').length;

function patchCurrent(s: DemoState, f: (p: Project) => Project): DemoState {
  if (!s.currentId) return s;
  return { ...s, projects: s.projects.map(p => (p.id === s.currentId ? f(p) : p)) };
}

export function reducer(s: DemoState, a: Action | InternalAction): DemoState {
  switch (a.type) {
    case 'open':
      return s.projects.some(p => p.id === a.id) ? { ...s, currentId: a.id } : s;
    case 'setStep':
      return patchCurrent(s, p => ({ ...p, step: a.step, updated: now() }));
    case 'setColor': {
      const next = patchCurrent(s, p => ({ ...p, updated: now(), objects: p.objects.map(o => (o.id === a.objectId ? { ...o, color: a.color } : o)) }));
      if (a.color === 'retain') return next;
      const c = a.color.toUpperCase();
      return { ...next, recentColors: [c, ...s.recentColors.filter(x => x.toUpperCase() !== c)].slice(0, 8) };
    }
    case 'setMood':
      return patchCurrent(s, p => ({ ...p, mood: a.mood, updated: now() }));
    case 'finishRender':
      return patchCurrent(s, p => {
        const n = colored(p), mood: MoodKey = p.mood ?? 'none';
        const kind: Render['kind'] = mood !== 'none' ? (n ? 'Colorize + mood' : 'Mood only') : 'Colorize only';
        const r: Render = { id: 'r' + Date.now().toString(36), at: now(), kind, mood, frames: 30, objects: n };
        return { ...p, step: 5, finished: true, updated: now(), renders: [r, ...p.renders] };
      });
    case 'createSample': {
      const have = s.projects.find(p => p.isSample);
      if (have) return { ...s, currentId: have.id };
      const p: Project = { id: 'sample', name: SAMPLE_NAME, step: 3, finished: false, updated: now(), mood: null,
        objects: makeObjects([null, null, null, null, null]), renders: [], isSample: true };
      return { ...s, projects: [p, ...s.projects], currentId: p.id };
    }
    case 'upload': {
      const p: Project = { id: 'u' + Date.now().toString(36), name: a.name, step: 1, finished: false, updated: now(), mood: null,
        objects: makeObjects([null, null, null, null, null]), renders: [] };
      return { ...s, projects: [p, ...s.projects], currentId: p.id };
    }
    case 'rename': {
      const name = a.name.trim();
      if (!name) return s;
      return { ...s, projects: s.projects.map(p => (p.id === a.id ? { ...p, name, updated: now() } : p)) };
    }
    case 'deleteRender':
      return { ...s, projects: s.projects.map(p => (p.id === a.projectId ? { ...p, renders: p.renders.filter(r => r.id !== a.renderId) } : p)) };
    case 'deleteProject':
      return { ...s, projects: s.projects.filter(p => p.id !== a.id), currentId: s.currentId === a.id ? null : s.currentId };
    case 'undoDelete':
      return s; // handled by the provider (it keeps the snapshot)
    case 'tour':
      return { ...s, tour: a.step == null ? null : { active: true, step: a.step } };
    case '_restore':
      return { ...s, projects: a.projects, currentId: a.currentId };
    case '_duplicate': {
      const src = s.projects.find(p => p.id === a.id);
      if (!src) return s;
      const name = /\.[^.]+$/.test(src.name) ? src.name.replace(/(\.[^.]+)$/, ' (copy)$1') : src.name + ' (copy)';
      const copy: Project = { ...src, id: a.newId, name, mood: null, step: 4, finished: false, updated: now(), renders: [], isSample: undefined };
      return { ...s, projects: [copy, ...s.projects], currentId: copy.id };
    }
    case '_seen':
      return s.firstRunSeen ? s : { ...s, firstRunSeen: true };
    default:
      return s;
  }
}

/* ---------- Persistence (sessionStorage, optional) ---------- */
const KEY = 'mp-demo-v1';
function load(): DemoState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return initialState;
    const v = JSON.parse(raw) as Partial<DemoState>;
    if (!v || !Array.isArray(v.projects)) return initialState;
    return { ...initialState, ...v, projects: v.projects } as DemoState;
  } catch {
    return initialState;
  }
}
function save(s: DemoState) {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: the demo still works */ }
}

/* ---------- Provider + hooks ---------- */
interface Ctx {
  state: DemoState;
  dispatch: (a: Action) => void;
  current: Project | null;
  /** Extra actions the fixed Action union does not cover. */
  extra: { duplicate: (id: string) => string; markFirstRunSeen: () => void };
}
const DemoContext = createContext<Ctx | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, raw] = useReducer(reducer, undefined, load);
  const snap = useRef<{ projects: Project[]; currentId: string | null } | null>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; save(state); }, [state]);

  const dispatch = useCallback((a: Action) => {
    if (a.type === 'deleteRender' || a.type === 'deleteProject') {
      snap.current = { projects: stateRef.current.projects, currentId: stateRef.current.currentId };
    }
    if (a.type === 'undoDelete') {
      if (snap.current) raw({ type: '_restore', ...snap.current });
      snap.current = null;
      return;
    }
    raw(a);
  }, []);
  const extra = useMemo(() => ({
    duplicate: (id: string) => { const newId = 'd' + Date.now().toString(36); raw({ type: '_duplicate', id, newId }); return newId; },
    markFirstRunSeen: () => raw({ type: '_seen' }),
  }), []);
  const current = useMemo(() => state.projects.find(p => p.id === state.currentId) ?? null, [state.projects, state.currentId]);
  const value = useMemo(() => ({ state, dispatch, current, extra }), [state, dispatch, current, extra]);
  return createElement(DemoContext.Provider, { value }, children);
}

function useCtx(): Ctx {
  const c = useContext(DemoContext);
  if (!c) throw new Error('useDemo must be used inside <DemoProvider>');
  return c;
}
export function useDemo(): { state: DemoState; dispatch: (a: Action) => void; current: Project | null } {
  const { state, dispatch, current } = useCtx();
  return { state, dispatch, current };
}
export function useDemoExtra() { return useCtx().extra; }

/* ---------- Small shared helpers ---------- */
export const coloredCount = colored;
export const isColor = (c: SceneObject['color']): c is string => !!c && c !== 'retain';
