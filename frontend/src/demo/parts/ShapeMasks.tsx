import { REGIONS, frontOf } from '../sceneRegions';

/* SVG masks for outlines drawn over the scene: one per region that something stands in front of
   (white = its own shape may show, black = hidden by what is in front), so an outline follows only the
   visible part, as the hit test does. `prefix` keeps ids unique per screen. Render once inside <defs>;
   point an outline at its mask with maskUrl (sceneRegions.ts). */
export function FrontMasks({ prefix }: { prefix: string }) {
  return (
    <>
      {REGIONS.filter(r => frontOf(r.id).length).map(r => (
        <mask key={r.id} id={`${prefix}-${r.id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="2100" height="900">
          <rect width="2100" height="900" fill="#fff" />
          {frontOf(r.id).map(fr => <path key={fr.id} d={fr.d} fill="#000" />)}
        </mask>
      ))}
    </>
  );
}
