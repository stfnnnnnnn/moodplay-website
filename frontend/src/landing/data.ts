import type { CSSProperties } from 'react';

/** Installer served from public/. */
export const INSTALLER_PATH = '/MoodPlayInstaller.exe';

export type MoodKey = 'none' | 'tokyo' | 'sunny' | 'blues';

export interface Mood {
  key: MoodKey;
  short: string;
  label: string;
  swatch: string[];
}

export const MOODS: Mood[] = [
  { key: 'none', short: 'Neutral', label: 'Neutral Realistic', swatch: ['#D9D4C7', '#5E6B78'] },
  { key: 'tokyo', short: 'Neo Tokyo', label: 'Neo Tokyo', swatch: ['#0D1B3D', '#E0447F', '#2EC4D6'] },
  { key: 'sunny', short: 'Warm Sunny', label: 'Warm Sunny', swatch: ['#F2B23A', '#E8833A'] },
  { key: 'blues', short: 'Sunday Blues', label: 'Sunday Blues', swatch: ['#3E6A8C', '#8FB3C9'] },
];

/** CSS preview of each mood, laid over the colorized frame. */
export function gradeStyle(key: MoodKey): CSSProperties {
  switch (key) {
    case 'tokyo':
      return { background: 'linear-gradient(180deg,rgba(13,27,61,.6),rgba(224,68,127,.3))', mixBlendMode: 'multiply', opacity: 1 };
    case 'sunny':
      return { background: 'linear-gradient(180deg,rgba(242,178,58,.5),rgba(232,131,58,.2))', mixBlendMode: 'soft-light', opacity: 1 };
    case 'blues':
      return { background: 'linear-gradient(180deg,rgba(62,106,140,.6),rgba(143,179,201,.28))', mixBlendMode: 'soft-light', opacity: 1 };
    default:
      return { background: 'transparent', opacity: 0 };
  }
}

/** Objects in the illustrated scene, positioned on the full 21:9 scene. */
export interface SceneObject { name: string; hex: string; top: string; left?: string; right?: string }
export const OBJECTS: SceneObject[] = [
  { name: 'Person 1', hex: '#C8326B', left: '12%', top: '31%' },
  { name: 'Car', hex: '#E39B2D', left: '42%', top: '54%' },
  { name: 'Shopfront', hex: '#2A9C9C', left: '28%', top: '14%' },
  { name: 'Person 2', hex: '#2F6FD6', left: '57%', top: '20%' },
  // Right-anchored so the label stays inside the frame at every width.
  { name: 'Person 3', hex: '#3E9B5C', right: '2.5%', top: '37%' },
];

/** Detection boxes fitted to the scene geometry (SVG viewBox 2100x900). */
const box = (x0: number, y0: number, x1: number, y1: number) => ({
  left: `${(x0 / 21).toFixed(2)}%`, top: `${(y0 / 9).toFixed(2)}%`,
  width: `${((x1 - x0) / 21).toFixed(2)}%`, height: `${((y1 - y0) / 9).toFixed(2)}%`,
});
export const BOXES = [
  { name: 'Person 1', ...box(340, 374, 540, 840), labelRight: false },
  { name: 'Shopfront', ...box(580, 230, 880, 550), labelRight: false },
  { name: 'Car', ...box(820, 540, 1340, 812), labelRight: true },
  { name: 'Person 2', ...box(1515, 346, 1705, 838), labelRight: true },
  { name: 'Person 3', ...box(1794, 424, 1946, 834), labelRight: true },
];

export const FILM_FRAMES = [
  // The camera pans across the whole scene, so every object appears in at least one frame.
  { label: 'Frame 1', pos: '10% 50%' },
  { label: 'Frame 40', pos: '40% 50%' },
  { label: 'Frame 80', pos: '70% 50%' },
  { label: 'Frame 120', pos: '100% 50%' },
];

export const STEPS = [
  { n: 1, name: 'Upload', sub: 'Add a clip', title: 'Start with a black-and-white clip', body: 'Open an MP4, MOV or AVI file. It stays on your computer.', tag: 'Original' },
  { n: 2, name: 'Detect', sub: 'Find objects', title: 'MoodPlay finds the objects', body: 'People, cars and walls are picked out and followed through the whole clip. Pick the ones you want to color.', tag: 'Objects found' },
  { n: 3, name: 'Colorize', sub: 'Pick colors', title: 'Pick a color for each object', body: 'Choose from presets or any hex code. Leave an object alone and it keeps its original look.', tag: 'Colorized' },
  { n: 4, name: 'Mood', sub: 'Set the look', title: 'Give the scene a mood', body: 'The mood changes the light. The colors you picked stay the same.', tag: '' },
  { n: 5, name: 'Results', sub: 'Compare and save', title: 'Compare, then save', body: 'Drag across the frame to check the result against the original, then save it as MP4.', tag: 'Original | Result' },
];

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
