import type { MoodKey, Project } from './store';

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
/** 1,234 (en-US grouping). */
export const num = (n: number) => n.toLocaleString('en-US');
export const plural = (n: number, one: string, many: string) => num(n) + ' ' + (n === 1 ? one : many);

/** Long file names differ at the end (v3, FINAL, .mov), so cut the middle. */
export function mid(s: string, n = 50): string {
  const a = [...s];
  return a.length > n ? a.slice(0, Math.round(n * .64)).join('') + '…' + a.slice(-Math.round(n * .32)).join('') : s;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
/** "Two" for 2 (sentence start), falls back to digits. */
export const word = (n: number) => WORDS[n] ?? String(n);
export const wordLower = (n: number) => (WORDS[n] ? WORDS[n].toLowerCase() : String(n));

/** Render video length + size, derived from the frame count (30 frames = 00:12, 18.4 MB in the mockups). */
export function renderLength(frames: number): string {
  const s = Math.max(1, Math.round(frames * 0.4)), m = Math.floor(s / 60);
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/** Mood shown on a project frame: only once the project reached Results or is finished. */
export const shownMood = (p: Project) => (p.finished || p.step >= 5 ? realMood(p.mood) : null);

/* ---------- The sample clip (ruling R9): one set of facts, read by every screen ----------
   12-second clip, 24 fps, 288 frames, 1920 × 1080 (v5-results.html; owner estimate copy "12-second clip"). */
export const CLIP = { seconds: 12, fps: 24, frames: 288, width: 1920, height: 1080, mb: 21.6 } as const;
/** "1920 × 1080" */
export const CLIP_SIZE = `${CLIP.width} × ${CLIP.height}`;
/** Seconds -> "0:12": a playhead position, so it counts whole seconds passed (floors). */
export const clipTime = (s: number) => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
/** Seconds -> "0:08": the nearest second, for the ends of a span (Detect's gaps), so a gap never reads "0:07 to 0:07". */
export const clipTimeNear = (s: number) => clipTime(Math.round(s));
/** Seconds -> "00:02" (the Colorize / Mood filmstrip header). */
export const clipTime2 = (s: number) => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
/** Frame (1-based) -> "0:03.5" (Results transport). */
export const clipTenths = (frame: number) => { const s = (frame - 1) / CLIP.fps; return Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0'); };
/** "12-second clip" (non-breaking hyphen keeps it on one line). */
export const CLIP_PHRASE = `${CLIP.seconds}‑second clip`;

/** The scene's 16:9 crop (the 2100×900 street scene without its edges), shared by every frame and thumbnail. */
export const CROP = '310 0 1680 900';

/** Each mood's three palette dots (Mood board, Results summary). */
export const MOOD_PAL: Record<MoodKey, string[]> = {
  none: ['#D9D4CB', '#8FA0B5', '#3F4654'],
  tokyo: ['#0D1B3D', '#E0447F', '#4C7BD9'],
  sunny: ['#F2B23A', '#E8833A', '#FBE3B0'],
  blues: ['#3E6A8C', '#8FB3C9', '#DCE6EE'],
};
