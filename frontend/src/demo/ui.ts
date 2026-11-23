import { createContext, useContext } from 'react';

/* Screen-level UI shared across the demo shell: the top-bar search query and the Undo toast. */
export interface DemoUi {
  query: string;
  setQuery: (q: string) => void;
  /** Show a toast. With onUndo it shows an Undo button and stays 6 s (pausing on hover/focus), else 3.5 s. */
  toast: (msg: string, onUndo?: () => void) => void;
}
export const DemoUiContext = createContext<DemoUi>({ query: '', setQuery: () => {}, toast: () => {} });
export const useDemoUi = () => useContext(DemoUiContext);

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A project action started from the Projects grid that the project page finishes after it opens
 *  (Rename and Delete open the project first, as in the mockup). Also remembers whether the page was
 *  opened from the grid, so "All projects" can go back in history instead of pushing a new entry. */
export const pending: { id: string | null; act: 'rename' | 'delete' | null; fromGrid: boolean } = { id: null, act: null, fromGrid: false };
export function setPending(id: string | null, act: 'rename' | 'delete' | null, fromGrid?: boolean) {
  pending.id = id; pending.act = act;
  if (fromGrid !== undefined) pending.fromGrid = fromGrid;
}
export function clearFromGrid() { pending.fromGrid = false; }
