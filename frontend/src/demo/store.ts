import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';

/* ---------- Types (fixed interface, see docs/superpowers/plans/2026-11-23-v5-web-demo.md) ---------- */
export type Step = 1 | 2 | 3 | 4 | 5;                       // Upload, Detect, Colorize, Mood, Results
export type MoodKey = 'none' | 'tokyo' | 'sunny' | 'blues';  // same keys as landing/data.ts MOODS
/** box = [x0, y0, x1, y1] in the scene's 2100×900 viewBox. */
export interface SceneObject { id: number; label: string; color: string | 'retain' | null; box: [number, number, number, number] }
/** A finished render. `mood` and `scene` are what it was rendered with (a snapshot), so Results and "Open at step"
 *  show and restore this render, not the project's later edits. `scene` is missing only in sessions saved before it existed. */
export interface Render { id: string; at: string; kind: 'Colorize + mood' | 'Colorize only' | 'Mood only'; mood: MoodKey; frames: number; objects: number; scene?: SceneObject[]; videoSrc?: string }
export interface Project { id: string; name: string; step: Step; finished: boolean; updated: string; mood: MoodKey | null; objects: SceneObject[]; renders: Render[];
  /** The render Results shows: the newest one, or the one reopened with "Open at step". Missing = the newest. */
  shownRender?: string; isSample?: boolean; videoSrc?: string }
export interface DemoState { projects: Project[]; currentId: string | null; recentColors: string[]; firstRunSeen: boolean; tour: { active: boolean; step: number } | null }
/** undoDelete restores the last deleted project or render; with forget it only drops it (its Undo toast is gone). */
export type Action =
  | { type: 'open'; id: string } | { type: 'setStep'; step: Step } | { type: 'setColor'; objectId: number; color: string | 'retain' }
  | { type: 'setMood'; mood: MoodKey | null } | { type: 'finishRender' } | { type: 'createSample' } | { type: 'upload'; name: string }
  | { type: 'rename'; id: string; name: string } | { type: 'deleteRender'; projectId: string; renderId: string } | { type: 'undoDelete'; forget?: true }
  | { type: 'deleteProject'; id: string } | { type: 'tour'; step: number | null; active?: boolean };

/* Internal actions (not part of the public interface). */
type InternalAction =
  | { type: '_restoreProject'; project: Project; index: number; wasCurrent: boolean }
  | { type: '_restoreRender'; projectId: string; render: Render; index: number }
  | { type: '_duplicate'; id: string; newId: string }
  | { type: '_seen' }
  | { type: '_objects'; objects: SceneObject[] }
  | { type: '_openRender'; projectId: string; renderId: string };

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
const run = (id: string, msAgo: number, kind: Render['kind'], mood: MoodKey, frames: number, colors: (string | null)[]): Render =>
  ({ id, at: ago(msAgo), kind, mood, frames, objects: colors.filter(Boolean).length, scene: makeObjects(colors) });
const NONE = [null, null, null, null, null];

/* Clip URLs are code-owned: the stored session never carries a videoSrc (parseStored drops it); after parsing
   it is attached again from these maps by id, so a reload keeps the clips without trusting storage.
   A duplicate's id ends in "_<root project id>", so it finds the clip of the project it was copied from.
   Empty until real clips land: every screen then shows the drawn scene. */
const PROJECT_VIDEO: Readonly<Record<string, string>> = {};
const RENDER_VIDEO: Readonly<Record<string, string>> = {};
const rootId = (id: string) => id.slice(id.lastIndexOf('_') + 1); // ids are base36 otherwise, so '_' only marks a copy
const own = (m: Readonly<Record<string, string>>, k: string) => (Object.prototype.hasOwnProperty.call(m, k) ? m[k] : undefined);
function withVideo(p: Project): Project {
  const videoSrc = own(PROJECT_VIDEO, rootId(p.id));
  const renders = p.renders.map(r => { const v = own(RENDER_VIDEO, r.id); return v ? { ...r, videoSrc: v } : r; });
  return videoSrc ? { ...p, videoSrc, renders } : { ...p, renders };
}

export const SAMPLE_PROJECTS: Project[] = ([
  { id: 'p2', name: 'old_film_bw.avi', step: 3, finished: false, updated: ago(26 * H), mood: null,
    objects: makeObjects([SAMPLE_COLORS[0], SAMPLE_COLORS[1], null, null, null]), renders: [] },
  { id: 'p1', name: 'family_walk.mov', step: 5, finished: true, updated: ago(.3 * H), mood: 'blues',
    objects: makeObjects(SAMPLE_COLORS),
    renders: [run('r13', .5 * H, 'Colorize + mood', 'blues', 30, SAMPLE_COLORS), run('r12', 5.4 * H, 'Colorize only', 'none', 30, SAMPLE_COLORS), run('r11', 22 * H, 'Mood only', 'sunny', 30, NONE)] },
  { id: 'p3', name: 'campus_night.mp4', step: 5, finished: true, updated: ago(4 * D), mood: 'tokyo',
    objects: makeObjects([...SAMPLE_COLORS.slice(0, 4), null]),
    renders: [run('r9', 4 * D, 'Colorize + mood', 'tokyo', 30, [...SAMPLE_COLORS.slice(0, 4), null])] },
  { id: 'p4', name: 'grandparents_wedding_1962.mov', step: 2, finished: false, updated: ago(5 * D), mood: null,
    objects: makeObjects(NONE), renders: [] },
] satisfies Project[]).map(withVideo);
export const SAMPLE_NAME = 'sample_family_walk.mov';

/* Ids: time plus a per-session counter, so two actions in the same millisecond never share an id. */
let seq = 0;
const uid = (prefix: string) => prefix + Date.now().toString(36) + (seq++).toString(36);

/** "night walk" -> "night walk (copy)", "a.mov" -> "a (copy).mov"; clamped first, so it still fits LIMITS.name. */
export function copyName(name: string): string {
  const ext = /\.[^.]{1,10}$/.exec(name)?.[0] ?? '';
  const base = [...name.slice(0, name.length - ext.length)].slice(0, LIMITS.name - ext.length - ' (copy)'.length).join('');
  return base + ' (copy)' + ext;
}

/* Limits shared by the inputs and the stored-state check, so the demo never writes a state it would reject. */
export const LIMITS = { name: 200, label: 200, objects: 50, renders: 200, projects: 200, tourSteps: 26 } as const;
const clampName = (n: string) => [...n].slice(0, LIMITS.name).join('');

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
const cloneObjects = (list: SceneObject[]): SceneObject[] => list.map(o => ({ ...o, box: [...o.box] as SceneObject['box'] }));

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
        const r: Render = { id: uid('r'), at: now(), kind, mood, frames: 30, objects: n, scene: cloneObjects(p.objects) };
        return { ...p, step: 5, finished: true, updated: now(), renders: [r, ...p.renders], shownRender: r.id };
      });
    case 'createSample': {
      const have = s.projects.find(p => p.isSample);
      if (have) return { ...s, currentId: have.id };
      const p: Project = withVideo({ id: 'sample', name: SAMPLE_NAME, step: 3, finished: false, updated: now(), mood: null,
        objects: makeObjects(NONE), renders: [], isSample: true });
      return { ...s, projects: [p, ...s.projects], currentId: p.id };
    }
    case 'upload': {
      const p: Project = { id: uid('u'), name: clampName(a.name), step: 1, finished: false, updated: now(), mood: null,
        objects: makeObjects(NONE), renders: [] };
      return { ...s, projects: [p, ...s.projects], currentId: p.id };
    }
    case 'rename': {
      const name = clampName(a.name.trim());
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
      // active: false = paused (the Resume chip shows); omitted = running
      return { ...s, tour: a.step == null ? null : { active: a.active ?? true, step: Math.min(LIMITS.tourSteps, Math.max(1, Math.round(a.step) || 1)) } };
    case '_restoreProject':
      // Undo of a project delete: put back only that project, at its old place (other edits made since are kept)
      if (s.projects.some(p => p.id === a.project.id)) return s;
      return { ...s, projects: [...s.projects.slice(0, a.index), a.project, ...s.projects.slice(a.index)], currentId: a.wasCurrent ? a.project.id : s.currentId };
    case '_restoreRender':
      return { ...s, projects: s.projects.map(p => (p.id !== a.projectId || p.renders.some(r => r.id === a.render.id) ? p
        : { ...p, renders: [...p.renders.slice(0, a.index), a.render, ...p.renders.slice(a.index)] })) };
    case '_duplicate': {
      const src = s.projects.find(p => p.id === a.id);
      if (!src) return s;
      const copy: Project = { ...src, id: a.newId, name: copyName(src.name), mood: null, step: 4, finished: false, updated: now(), renders: [], shownRender: undefined, isSample: undefined };
      return { ...s, projects: [copy, ...s.projects], currentId: copy.id };
    }
    case '_objects':
      return patchCurrent(s, p => ({ ...p, objects: a.objects, updated: now() }));
    case '_openRender': {
      // "Open at step": reopen the project with this render's colours and mood (its snapshot)
      const p = s.projects.find(x => x.id === a.projectId), r = p?.renders.find(x => x.id === a.renderId);
      if (!p || !r) return s;
      const objects = r.scene ? cloneObjects(r.scene) : p.objects;
      return { ...s, currentId: p.id, projects: s.projects.map(x => (x.id === p.id ? { ...x, objects, mood: r.mood, shownRender: r.id, updated: now() } : x)) };
    }
    case '_seen':
      return s.firstRunSeen ? s : { ...s, firstRunSeen: true };
    default:
      return s;
  }
}

/* ---------- Persistence (sessionStorage, optional) ---------- */
const KEY = 'mp-demo-v1';

/* Schema check for the stored session (security report L2), with local repair. The overall shape must be right
   (an object with a projects array), or everything is discarded and the demo starts fresh. Inside it, each bad
   project, object or render is dropped, and over-long text or out-of-range values are clamped, so one odd field
   never costs the whole session. Nothing that is not plain data survives (a stored videoSrc is always removed;
   clips come back only from the code-owned maps, see withVideo), so a
   corrupt or tampered value can never crash a render or reach the DOM. The limits match the inputs (LIMITS). */
type U = unknown;
const isObj = (v: U): v is Record<string, U> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: U): v is number => Number.isInteger(v);
const clampInt = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const cut = (v: string, max: number) => [...v].slice(0, max).join('');
const isDate = (v: U): v is string => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
const HEX = /^#[0-9a-f]{6}$/i;
const MOODS: readonly U[] = ['none', 'tokyo', 'sunny', 'blues'];
const KINDS: readonly U[] = ['Colorize + mood', 'Colorize only', 'Mood only'];
const nowIso = () => new Date().toISOString();

function repairObject(o: U): SceneObject | null {
  if (!isObj(o) || !isInt(o.id) || o.id < 1 || o.id > 9999 || typeof o.label !== 'string') return null;
  if (!Array.isArray(o.box) || o.box.length !== 4 || !o.box.every(n => typeof n === 'number' && Number.isFinite(n))) return null;
  const color = o.color === 'retain' || (typeof o.color === 'string' && HEX.test(o.color)) ? o.color : null;
  return { id: o.id, label: cut(o.label, LIMITS.label), color, box: o.box as SceneObject['box'] };
}
function repairRender(r: U): Render | null {
  if (!isObj(r) || typeof r.id !== 'string' || !r.id || r.id.length > 64 || !KINDS.includes(r.kind) || !MOODS.includes(r.mood)) return null;
  if (!isInt(r.frames) || !isInt(r.objects)) return null;
  const out: Render = { id: r.id, at: isDate(r.at) ? r.at : nowIso(), kind: r.kind as Render['kind'], mood: r.mood as MoodKey,
    frames: clampInt(r.frames, 0, 100000), objects: clampInt(r.objects, 0, 9999) };
  // the colour snapshot is repaired like the project's objects (bad ones dropped, labels clamped, unique ids,
  // at most LIMITS.objects); a snapshot that is not an array is dropped on its own and the render is kept
  if (Array.isArray(r.scene)) out.scene = repairObjects(r.scene);
  return out;
}
function repairObjects(list: U[]): SceneObject[] {
  const seen = new Set<number>();
  return list.map(repairObject).filter((o): o is SceneObject => !!o && !seen.has(o.id) && !!seen.add(o.id)).slice(0, LIMITS.objects);
}
function repairProject(p: U): Project | null {
  if (!isObj(p) || typeof p.id !== 'string' || !p.id || p.id.length > 64 || typeof p.name !== 'string' || !p.name.trim() || !isInt(p.step)) return null;
  const objects = repairObjects(Array.isArray(p.objects) ? p.objects : []);
  const renders = (Array.isArray(p.renders) ? p.renders : []).map(repairRender).filter((r): r is Render => !!r).slice(0, LIMITS.renders);
  const out: Project = {
    id: p.id, name: cut(p.name, LIMITS.name), step: clampInt(p.step, 1, 5) as Step, finished: p.finished === true,
    updated: isDate(p.updated) ? p.updated : nowIso(), mood: MOODS.includes(p.mood) ? (p.mood as MoodKey) : null, objects, renders,
  };
  if (typeof p.shownRender === 'string' && renders.some(r => r.id === p.shownRender)) out.shownRender = p.shownRender;
  if (p.isSample === true) out.isSample = true;
  return out;
}

/** The stored value as DemoState (repaired where needed), or null when its overall shape is wrong. Known keys only. */
export function parseStored(v: U): DemoState | null {
  if (!isObj(v) || !Array.isArray(v.projects)) return null;
  const ids = new Set<string>();
  const projects = v.projects.map(repairProject)
    .filter((p): p is Project => !!p && !ids.has(p.id) && !!ids.add(p.id)).slice(0, LIMITS.projects).map(withVideo);
  const currentId = typeof v.currentId === 'string' && ids.has(v.currentId) ? v.currentId : null;
  const recentColors = Array.isArray(v.recentColors)
    ? v.recentColors.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, 16)
    : initialState.recentColors;
  const t = v.tour;
  const tour = isObj(t) && typeof t.active === 'boolean' && isInt(t.step) ? { active: t.active, step: clampInt(t.step, 1, LIMITS.tourSteps) } : null;
  return { projects, currentId, recentColors, firstRunSeen: v.firstRunSeen === true, tour };
}
function load(): DemoState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw || raw.length > 1_000_000) return initialState;
    return parseStored(JSON.parse(raw)) ?? initialState;
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
  extra: {
    duplicate: (id: string) => string;
    markFirstRunSeen: () => void;
    setObjects: (objects: SceneObject[]) => void;
    openRender: (projectId: string, renderId: string) => void;
  };
}
const DemoContext = createContext<Ctx | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, raw] = useReducer(reducer, undefined, load);
  // Undo keeps only the deleted item and where it was (like Detect's own Undo), so edits made while the toast shows survive
  const snap = useRef<InternalAction | null>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; save(state); }, [state]);

  const dispatch = useCallback((a: Action) => {
    const s = stateRef.current;
    if (a.type === 'deleteProject') {
      const index = s.projects.findIndex(p => p.id === a.id);
      snap.current = index < 0 ? null : { type: '_restoreProject', project: s.projects[index], index, wasCurrent: s.currentId === a.id };
    }
    if (a.type === 'deleteRender') {
      const p = s.projects.find(x => x.id === a.projectId), index = p ? p.renders.findIndex(r => r.id === a.renderId) : -1;
      snap.current = !p || index < 0 ? null : { type: '_restoreRender', projectId: p.id, render: p.renders[index], index };
    }
    if (a.type === 'undoDelete') {
      if (snap.current && !a.forget) raw(snap.current);
      snap.current = null;
      return;
    }
    raw(a);
  }, []);
  /** Copy a project; returns the copy's id. Its stored name is copyName(source name), which callers show too. */
  const duplicate = useCallback((id: string) => {
    const newId = uid('d') + '_' + rootId(id);
    raw({ type: '_duplicate', id, newId });
    return newId;
  }, []);
  /** The Undo toast ran out or was replaced: forget the deleted item. */
  const extra = useMemo(() => ({
    duplicate,
    markFirstRunSeen: () => raw({ type: '_seen' }),
    /** Detect: replace the current project's objects (renamed, removed, added). */
    setObjects: (objects: SceneObject[]) => raw({ type: '_objects', objects }),
    /** Project page "Open at step": open the project with this render's colours and mood. */
    openRender: (projectId: string, renderId: string) => raw({ type: '_openRender', projectId, renderId }),
  }), [duplicate]);
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
/** The render Results shows for a project (see Project.shownRender), or null before the first render. */
export const shownRenderOf = (p: Project): Render | null => p.renders.find(r => r.id === p.shownRender) ?? p.renders[0] ?? null;
export const coloredCount = colored;
export const isColor = (c: SceneObject['color']): c is string => !!c && c !== 'retain';
