import type { Step } from '../store';

/* Hand-offs between step screens that are not part of the URL (like ui.ts `pending`):
   Upload -> Detect starts detection when it opens. */
export const flow: { autoDetect: boolean } = { autoDetect: false };

/** The rail's "reached" step for a project shown on step `at`. */
export const reachedFor = (p: { step: Step; finished: boolean } | null, at: Step): Step =>
  (p ? (p.finished ? 5 : Math.max(p.step, at)) : at) as Step;
