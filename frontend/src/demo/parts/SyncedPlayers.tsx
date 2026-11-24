import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Scene } from '../scene';
import { StripFrames } from './StripFrames';
import { CLIP, clipTenths } from '../format';
import { prefersReducedMotion } from '../ui';
import type { MoodKey, SceneObject } from '../store';

/* Results players (v5-results.html): the original and the colorized video share ONE playhead.
   View: Original / Colorized / Side by side (default), plus Swap sides. Play/pause drives both; K toggles it,
   and Space plays only while the play button has focus (native button behaviour; no hold-Space on Results).
   Without a real video (videoSrc unset) the "video" is the scene panning across the shot with the mood
   overlay on top; with one, both <video> elements follow the same playhead. The playhead is written straight
   to the DOM (CSS variables + text), so playing and scrubbing cause no React renders.
   Reduced motion: the frame stays still (no pan, no crossfade); the playhead and time code still follow
   what you do, because they are content. */

type Mode = 'orig' | 'col' | 'sbs';
const N = CLIP.frames, FPS = CLIP.fps;
const START = 84; // the mockup's frame

export interface SyncedPlayersProps {
  objects: SceneObject[];
  mood: MoodKey | null;
  moodName: string | null;
  /** Optional real videos: the uploaded original and the render. Unset: the scene + overlay stand in. */
  originalSrc?: string;
  colorSrc?: string;
}

export function SyncedPlayers({ objects, mood, moodName, originalSrc, colorSrc }: SyncedPlayersProps) {
  const [mode, setModeState] = useState<Mode>('sbs');
  const [swapped, setSwapped] = useState(false);
  const [fading, setFading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reduce] = useState(prefersReducedMotion);

  const stage = useRef<HTMLDivElement>(null);
  const scrub = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const tc = useRef<HTMLSpanElement>(null);
  const fr = useRef<HTMLSpanElement>(null);
  const vids = useRef<(HTMLVideoElement | null)[]>([]);
  const frame = useRef(START);
  const raf = useRef(0);
  const fadeT = useRef(0), fadeRaf = useRef(0);
  const playingRef = useRef(false);

  /** Paint frame f on both players, the scrub and the labels (DOM only). */
  const show = useCallback((f: number, seekVideos = true) => {
    const v = Math.max(1, Math.min(N, Math.round(f)));
    frame.current = v;
    const p = (v - 1) / (N - 1);
    if (!reduce) stage.current?.style.setProperty('--pan', p.toFixed(4));
    scrub.current?.style.setProperty('--p', p.toFixed(4));
    if (range.current) { range.current.value = String(v); range.current.setAttribute('aria-valuetext', `Frame ${v} of ${N}`); }
    if (tc.current) tc.current.textContent = clipTenths(v);
    if (fr.current) fr.current.textContent = `Frame ${v} of ${N}`;
    if (seekVideos) vids.current.forEach(el => { if (el) el.currentTime = (v - 1) / FPS; });
  }, [reduce]);

  const pause = useCallback(() => {
    cancelAnimationFrame(raf.current);
    playingRef.current = false; setPlaying(false);
    vids.current.forEach(el => el?.pause());
  }, []);
  const play = useCallback(() => {
    if (frame.current >= N) show(1);
    playingRef.current = true; setPlaying(true);
    const live = vids.current.filter((el): el is HTMLVideoElement => !!el);
    live.forEach(el => { void el.play().catch(() => {}); });
    let last = performance.now(), acc = 0, synced = 0;
    const tick = (now: number) => {
      if (!playingRef.current) return;
      if (live.length) {
        const lead = live[0];
        // a clip that ends early (or a player that stops) ends playback for both, and the loop stops
        if (lead.ended || live.some(el => el.ended)) { show(lead.currentTime * FPS + 1, false); pause(); return; }
        // keep the second video on the first: resync only past 3 frames of drift, at most every 500 ms
        // (seeking on every small drift makes the second player stutter)
        if (now - synced >= 500) {
          for (const el of live.slice(1)) if (Math.abs(el.currentTime - lead.currentTime) > 3 / FPS) { el.currentTime = lead.currentTime; synced = now; }
        }
        show(lead.currentTime * FPS + 1, false);
      } else {
        acc += ((now - last) / 1000) * FPS;
        if (acc >= 1) { const step = Math.floor(acc); acc -= step; show(frame.current + step); }
      }
      last = now;
      if (frame.current >= N) { pause(); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [show, pause]);
  const toggle = useCallback(() => (playingRef.current ? pause() : play()), [play, pause]);

  useEffect(() => { show(START); }, [show]);
  useEffect(() => () => { cancelAnimationFrame(raf.current); cancelAnimationFrame(fadeRaf.current); window.clearTimeout(fadeT.current); }, []);

  // K plays and pauses both (not while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'k' && e.key !== 'K') return;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as Element | null;
      if (t?.closest('input:not([type=range]),textarea,select,[contenteditable]')) return;
      e.preventDefault(); toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // view changes crossfade in 150 ms (never a hard cut; global motion range 150-220 ms); reduced motion swaps at once
  const crossfade = (apply: () => void) => {
    if (reduce) { apply(); return; }
    window.clearTimeout(fadeT.current);
    setFading(true);
    fadeT.current = window.setTimeout(() => { apply(); fadeRaf.current = requestAnimationFrame(() => setFading(false)); }, 150);
  };
  const setMode = (m: Mode) => { if (m !== mode) crossfade(() => setModeState(m)); };
  const swap = () => { if (mode === 'sbs') crossfade(() => setSwapped(s => !s)); };

  const colLabel = moodName ? `Colorized, ${moodName}` : 'Colorized';
  const player = (kind: 'orig' | 'col') => {
    const src = kind === 'orig' ? originalSrc : colorSrc;
    return (
      <figure className={'rs-pl ' + kind} aria-label={kind === 'orig' ? 'Original' : colLabel}>
        <div className="rs-frame">
          {src
            ? <video ref={el => { vids.current[kind === 'orig' ? 0 : 1] = el; }} className="scene" src={src} muted playsInline preload="metadata" onEnded={pause} style={{ objectFit: 'cover' }} />
            : <div className="rs-pan"><Scene variant={kind === 'orig' ? 'gray' : 'color'} objects={kind === 'orig' ? undefined : objects} mood={kind === 'orig' ? null : mood} /></div>}
          {src && kind === 'col' && mood && mood !== 'none' ? <span className={'grade g-' + mood} aria-hidden="true" /> : null}
        </div>
      </figure>
    );
  };

  return (
    <>
      <div className="shead" data-tour="tut_compare">
        <div className="rs-seg" role="group" aria-label="View">
          {([['orig', 'Original'], ['col', 'Colorized'], ['sbs', 'Side by side']] as const).map(([m, label]) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{label}</button>
          ))}
        </div>
        <button className="btn btn-quiet rs-swap" type="button" aria-disabled={mode !== 'sbs'} onClick={swap}
          title={mode !== 'sbs' ? 'Choose Side by side to swap sides' : undefined}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4 3 8l4 4" /><path d="M3 8h14" /><path d="m17 20 4-4-4-4" /><path d="M21 16H7" /></svg>
          Swap sides
        </button>
      </div>

      <div ref={stage} className={'viewer rcmp' + (swapped ? ' swapped' : '')} id="stage" data-mode={mode} data-tour="tut_compare">
        <div className={'rs-pair' + (fading ? ' fading' : '')}>
          {player('orig')}
          {player('col')}
        </div>
      </div>

      <div className="card rs-transport">
        <button className="rs-play" type="button" aria-label={playing ? 'Pause both videos' : 'Play both videos'} onClick={toggle}>
          {playing
            ? <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1.2" /><rect x="14" y="4" width="4" height="16" rx="1.2" /></svg>
            : <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l11.5-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8z" /></svg>}
        </button>
        <span className="rs-tc"><span ref={tc}>{clipTenths(START)}</span> <span className="of">/ {clipTenths(N + 1)}</span></span>
        <div className="rs-scrub" ref={scrub} style={{ '--p': (START - 1) / (N - 1) } as CSSProperties}>
          <div className="rs-strip" aria-hidden="true">
            <StripFrames n={12} variant="color" objects={objects} mood={mood} className="rs-th" />
          </div>
          <div className="rs-track" aria-hidden="true"><i /></div>
          <div className="rs-head" aria-hidden="true" />
          <input ref={range} type="range" min={1} max={N} defaultValue={START} aria-label="Playhead, moves both videos"
            aria-valuetext={`Frame ${START} of ${N}`} onChange={e => { if (playingRef.current) pause(); show(+e.target.value); }} />
        </div>
        <span className="rs-fr" ref={fr}>Frame {START} of {N}</span>
      </div>
    </>
  );
}
