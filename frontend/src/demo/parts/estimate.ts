import type { MoodKey } from '../store';

/* Render time estimate (app-direction-v5.md owner rule 7), computed rather than fixed copy:
   frames to colorize × seconds per frame. Seconds per frame are the mean of earlier runs on this computer
   (History); with no history the app falls back to DEFAULT_SPF. The demo uses the mockup's numbers:
   30 frames × 3.90 s (colours) + 30 × 3.84 s (mood) = 232 s ≈ 4 minutes. */
export const RENDER_FRAMES = 30;
export const DEFAULT_SPF = { color: 4.5, grade: 4.5 };
export const HISTORY_SPF: { color: number; grade: number } | null = { color: 3.90, grade: 3.84 };
export const SPF = HISTORY_SPF ?? DEFAULT_SPF;

export function renderEstimate(mood: MoodKey | null) {
  const graded = !!mood && mood !== 'none';
  const stages = [RENDER_FRAMES * SPF.color, ...(graded ? [RENDER_FRAMES * SPF.grade] : [])];
  const seconds = stages.reduce((a, b) => a + b, 0);
  const min = Math.max(1, Math.round(seconds / 60));
  return { seconds, stages, text: min === 1 ? '1 minute' : min + ' minutes' };
}
