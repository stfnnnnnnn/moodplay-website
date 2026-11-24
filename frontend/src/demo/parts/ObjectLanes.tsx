import { memo, useCallback, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { StripFrames } from './StripFrames';
import { CLIP, clipTime, clipTimeNear, num as n } from '../format';

/* Detect's signature move (v5-detect.html): the filmstrip and one thin lane per object share one time axis.
   Blue bars = where the object was found; hatched pink gaps = where it went missing (click one to jump there).
   During detection a bar fills along the top of the filmstrip and the lanes reveal up to the progress. */

export type Gap = [number, number];
export interface LaneObject { id: number; name: string; gaps: Gap[]; pending?: boolean }

const DUR = CLIP.seconds;

export const ObjectLanes = memo(function ObjectLanes({ objs, sel, head, running, prog, onScrub, onJump }: {
  objs: LaneObject[]; sel: number | null; head: number; running: boolean; prog: number;
  onScrub: (head: number) => void; onJump: (id: number, gap: Gap) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const t = head * DUR, F = CLIP.frames;
  const scrubTo = (x: number) => { const r = strip.current!.getBoundingClientRect(); onScrub(Math.min(.999, Math.max(0, (x - r.left) / r.width))); };
  const onDown = (e: RPointerEvent<HTMLDivElement>) => { if (running) return; e.currentTarget.setPointerCapture(e.pointerId); scrubTo(e.clientX); };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubTo(e.clientX); };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!d || running) return;
    e.preventDefault(); onScrub(Math.min(.999, Math.max(0, head + d / DUR)));
  };
  const nowCell = running ? Math.min(13, Math.floor(prog * 14)) : -1;
  const cellClass = useCallback((i: number) => (i === nowCell ? 'now' : ''), [nowCell]);

  return (
    <div className="tl" id="tl" data-tour="tut_lanes" style={{ '--h': head } as CSSProperties}>
      <div className="tl-head">
        <span className="tc">{clipTime(t)} / {clipTime(DUR)}</span>
        <span className="muted">Frame {n(Math.min(F, Math.floor(head * F) + 1))} of {n(F)}</span>
        <span className="grow" />
        <span className="lanes-key"><i aria-hidden="true" />Not found. Click a gap to jump there.</span>
      </div>
      <div className="rowlbl">Clip</div>
      <div ref={strip} className="dstrip" role="slider" tabIndex={0} aria-label="Playhead" aria-valuemin={0} aria-valuemax={DUR}
        aria-valuenow={Math.round(t)} aria-valuetext={clipTime(t)} onPointerDown={onDown} onPointerMove={onMove} onKeyDown={onKey}>
        <StripFrames n={14} cellClass={cellClass} />
        <div className="pbar" style={{ transform: `scaleX(${running ? prog : 0})` }} />
      </div>
      <div className="lanes" id="lanes" role="group" aria-label="Where each object was found">
        {objs.map(o => {
          const segs = [...o.gaps].sort((a, b) => a[0] - b[0]);
          const found: Gap[] = [];
          let at = 0;
          segs.forEach(g => { if (g[0] > at) found.push([at, g[0]]); at = Math.max(at, g[1]); });
          if (at < 1 && !o.pending) found.push([at, 1]);
          return (
            <div key={o.id} className={'lane-row' + (o.id === sel ? ' sel' : '')} data-o={o.id}>
              <div className="rowlbl"><span className="obj">{o.id}</span><span className="nm">{o.name}</span></div>
              <div className="track" style={running ? { clipPath: `inset(0 ${(1 - prog) * 100}% 0 0)` } : undefined}>
                {found.map((s, i) => <i key={i} className="seg-f" style={{ left: s[0] * 100 + '%', width: (s[1] - s[0]) * 100 + '%' }} />)}
                {segs.map((g, i) => (
                  <button key={i} type="button" className="gap" data-tour="tut_gap" style={{ left: g[0] * 100 + '%', width: `max(8px, ${(g[1] - g[0]) * 100}%)` }}
                    aria-label={`${o.name} not found from ${clipTimeNear(g[0] * DUR)} to ${clipTimeNear(g[1] * DUR)}. Jump there`}
                    title={`Not found ${clipTimeNear(g[0] * DUR)} to ${clipTimeNear(g[1] * DUR)}. Click to jump there`}
                    tabIndex={running ? -1 : 0} onClick={() => onJump(o.id, g)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="dplayhead" aria-hidden="true" />
    </div>
  );
});
