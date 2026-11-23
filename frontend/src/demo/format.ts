import type { MoodKey, Project } from './store';
import { STEP_NAMES } from './store';

/* Copy + date helpers shared by the demo screens (ported from v5-projects-b.html). */

export const MOOD_LABEL: Record<MoodKey, string> = { none: 'Neutral Realistic', tokyo: 'Neo Tokyo', sunny: 'Warm Sunny', blues: 'Sunday Blues' };
export const MOOD_DOT: Record<MoodKey, string> = {
  none: 'linear-gradient(135deg,#D9D4C7,#5E6B78)',
  tokyo: 'linear-gradient(135deg,#0D1B3D,#E0447F)',
  sunny: 'linear-gradient(135deg,#F2B23A,#E8833A)',
  blues: 'linear-gradient(135deg,#3E6A8C,#8FB3C9)',
};
/** A mood that is actually applied (Neutral counts as none on cards). */
export const realMood = (m: MoodKey | null | undefined): Exclude<MoodKey, 'none'> | null => (m && m !== 'none' ? m : null);

const D = 864e5;
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }

export function day(iso: string): string {
  const t = new Date(iso).getTime(), today = startOfToday();
  if (t >= today) return 'Today';
  if (t >= today - D) return 'Yesterday';
  const d = new Date(t);
  return d.toLocaleDateString('en-US', d.getFullYear() === new Date().getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
export const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
/** "Today 16:12", "Yesterday", "Nov 18". */
export function short(iso: string): string {
  const d = day(iso);
  return d === 'Today' ? 'Today ' + new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d;
}
export const plural = (n: number, one: string, many: string) => n.toLocaleString('en-US') + ' ' + (n === 1 ? one : many);

/** Long file names differ at the end (v3, FINAL, .mov), so cut the middle. */
export function mid(s: string, n = 50): string {
  const a = [...s];
  return a.length > n ? a.slice(0, Math.round(n * .64)).join('') + '…' + a.slice(-Math.round(n * .32)).join('') : s;
}

export const stepName = (p: Project) => STEP_NAMES[p.step - 1];

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
/** "Two" for 2 (sentence start), falls back to digits. */
export const word = (n: number) => WORDS[n] ?? String(n);
export const wordLower = (n: number) => (WORDS[n] ? WORDS[n].toLowerCase() : String(n));

/** Render video length + size, derived from the frame count (30 frames = 00:12, 18.4 MB in the mockups). */
export function renderLength(frames: number): string {
  const s = Math.max(1, Math.round(frames * 0.4)), m = Math.floor(s / 60);
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
export function renderSize(frames: number): string {
  const mb = frames * 0.613;
  return mb >= 1000 ? (mb / 1000).toFixed(1) + ' GB' : (mb >= 100 ? Math.round(mb) : mb.toFixed(1)) + ' MB';
}

/** Mood shown on a project frame: only once the project reached Results or is finished. */
export const shownMood = (p: Project) => (p.finished || p.step >= 5 ? realMood(p.mood) : null);
