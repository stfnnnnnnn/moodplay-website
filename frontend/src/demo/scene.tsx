import { memo } from 'react';
import { SAMPLE_COLORS, isColor, shapeOf, type MoodKey, type SceneObject } from './store';
import { REGIONS, type RegionId } from './sceneRegions';

/* The mockup street scene (scene-gray.svg / scene-color.svg, viewBox 2100×900), drawn inline from the region
   table (sceneRegions.ts) so each marked object takes the colour picked for it, with its exact shape.
   variant="color" also colours the background (sky, unmarked buildings, road); variant="gray" keeps the
   background black and white, as in a frame being colorized. Custom areas drawn in Detect are coloured
   with their own polygon, on top. */

export interface SceneProps {
  variant?: 'gray' | 'color';
  /** Object colours. Omitted: the sample colours for variant="color", all grey for variant="gray". */
  objects?: SceneObject[];
  mood?: MoodKey | null;
  /** Crop, e.g. "310 0 1680 900" for a 16:9 thumbnail (the mockups' project cards). */
  viewBox?: string;
  className?: string;
  /** Optional real video for this frame (demo videos are added later). */
  videoSrc?: string;
}

function SceneSvg({ variant = 'gray', objects, viewBox = '0 0 2100 900', className }: SceneProps) {
  const colorOf = new Map<RegionId, string>();
  const polys: { id: number; pts: number[]; color: string }[] = [];
  if (objects) {
    for (const o of objects) {
      const s = shapeOf(o);
      if (!s || !isColor(o.color)) continue;
      if (s.kind === 'region') colorOf.set(s.id, o.color);
      else polys.push({ id: o.id, pts: s.pts, color: o.color });
    }
  } else if (variant === 'color') {
    REGIONS.forEach(r => { if (r.sample != null) colorOf.set(r.id, SAMPLE_COLORS[r.sample]); });
  }
  return (
    <svg className={'scene' + (className ? ' ' + className : '')} viewBox={viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="2100" height="900" fill="#5C5F66" />
      {REGIONS.map(r => {
        const c = colorOf.get(r.id);
        return (
          <g key={r.id} fill={c ?? r.base[variant]}>
            {r.parts.map((p, i) => (p.k === 'rect'
              ? <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} fill={p.fill} />
              : p.k === 'circle'
                ? <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill ?? (c && p.skin ? p.skin : undefined)} />
                : <path key={i} d={p.d} />))}
          </g>
        );
      })}
      {polys.map(p => <polygon key={p.id} points={p.pts.join(' ')} fill={p.color} fillOpacity=".72" />)}
    </svg>
  );
}

/** Scene frame plus the CSS mood overlay. Fills its (positioned) parent. */
export const Scene = memo(function Scene(props: SceneProps) {
  const { mood, videoSrc } = props;
  return (
    <>
      {videoSrc
        ? <video className="scene" src={videoSrc} muted loop playsInline autoPlay style={{ objectFit: 'cover' }} />
        : <SceneSvg {...props} />}
      {mood && mood !== 'none' ? <span className={'grade g-' + mood} aria-hidden="true" /> : null}
    </>
  );
});
