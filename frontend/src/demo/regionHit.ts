import { REGIONS, frontOf, shapePath, type Region, type Shape } from './sceneRegions';

/* Shape geometry for Detect, in scene units (viewBox 2100×900): exact point-in-shape tests (Path2D) and coarse
   masks (a 210×90 grid) for areas and overlap. Like the app's mask hit_test: a point belongs to the smallest
   shape that contains it, and a region only counts where nothing stands in front of it. */

const GW = 210, GH = 90, S = GW / 2100;
let ctx: CanvasRenderingContext2D | null = null;
function c2d(): CanvasRenderingContext2D | null {
  if (!ctx) {
    const c = document.createElement('canvas');
    c.width = GW; c.height = GH;
    ctx = c.getContext('2d', { willReadFrequently: true });
  }
  return ctx;
}
const paths = new Map<string, Path2D>();
const p2d = (d: string) => { let p = paths.get(d); if (!p) { p = new Path2D(d); paths.set(d, p); } return p; };

function inside(d: string, x: number, y: number): boolean {
  const c = c2d();
  if (!c) return false;
  c.setTransform(1, 0, 0, 1, 0, 0);
  return c.isPointInPath(p2d(d), x, y);
}
/** Is the point on the visible part of the shape? */
export function inShape(s: Shape, x: number, y: number): boolean {
  if (!inside(shapePath(s), x, y)) return false;
  return s.kind === 'poly' || !frontOf(s.id).some(f => inside(f.d, x, y));
}

export type Mask = Uint8Array;
const masks = new Map<string, Mask>();
/** The visible part of a shape on the coarse grid (1 = covered). */
export function maskOf(s: Shape): Mask {
  const key = s.kind === 'region' ? s.id : s.pts.join(',');
  const hit = masks.get(key);
  if (hit) return hit;
  const out = new Uint8Array(GW * GH), c = c2d();
  if (c) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, GW, GH);
    c.setTransform(S, 0, 0, S, 0, 0);
    c.fillStyle = '#000';
    c.fill(p2d(shapePath(s)));
    if (s.kind === 'region') {
      c.globalCompositeOperation = 'destination-out';
      frontOf(s.id).forEach(f => c.fill(p2d(f.d)));
      c.globalCompositeOperation = 'source-over';
    }
    const a = c.getImageData(0, 0, GW, GH).data;
    for (let i = 0; i < out.length; i++) out[i] = a[i * 4 + 3] > 127 ? 1 : 0;
  }
  if (masks.size > 200) masks.clear(); // custom shapes come and go; regions are re-made on demand
  masks.set(key, out);
  return out;
}
export const areaOf = (m: Mask) => { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; return n; };
export function iou(a: Mask, b: Mask): number {
  let both = 0, either = 0;
  for (let i = 0; i < a.length; i++) { both += a[i] & b[i]; either += a[i] | b[i]; }
  return either ? both / either : 0;
}

/** The marked object under the point: the smallest visible shape that contains it. */
export function hitObject<T extends { id: number; shape: Shape }>(objs: readonly T[], x: number, y: number): T | null {
  let best: T | null = null, bestArea = Infinity;
  for (const o of objs) {
    if (!inShape(o.shape, x, y)) continue;
    const a = areaOf(maskOf(o.shape));
    if (a < bestArea) { best = o; bestArea = a; }
  }
  return best;
}
/** The region under the point (detectable or background), front-most first. */
export function hitRegion(x: number, y: number): Region | null {
  for (let i = REGIONS.length - 1; i >= 0; i--) {
    const r = REGIONS[i];
    if (x >= r.box[0] && x <= r.box[2] && y >= r.box[1] && y <= r.box[3] && inside(r.d, x, y)) return r;
  }
  return null;
}
/** The detectable region a drawn shape mostly covers (IoU of the visible masks), with the score. */
export function snapRegion(drawn: Mask): { region: Region; score: number } | null {
  let best: { region: Region; score: number } | null = null;
  for (const r of REGIONS) {
    if (!r.detectable) continue;
    const score = iou(drawn, maskOf({ kind: 'region', id: r.id }));
    if (!best || score > best.score) best = { region: r, score };
  }
  return best;
}
