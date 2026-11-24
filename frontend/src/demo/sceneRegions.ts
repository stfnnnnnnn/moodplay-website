/* The scene's "instance masks": every drawable thing in the street scene (viewBox 2100×900) as a named region
   with its exact shape. scene.tsx draws from this table, Detect outlines, hit-tests and snaps to it, and
   add-by-name searches it. One table, so a marked object is coloured with the same shape in every view.

   d      the outline (mask) path, one closed path per region (union drawn by hand where parts overlap, e.g. the car)
   parts  how scene.tsx paints it (fill comes from the object's colour, or `base` while it has none)
   z      paint order; a region's visible mask is its own shape minus every region with a higher z (people stand in
          front of buildings, so clicking a person never selects the building behind)
   gaps   where the region is not found along the clip (fractions of the clip), as the lanes show it */

export type Box = [number, number, number, number];
export type Gap = [number, number];
export type RegionKind = 'person' | 'shop' | 'car' | 'building' | 'sky' | 'road';
export type RegionId =
  | 'sky' | 'building1' | 'building2' | 'building3' | 'building4' | 'shop' | 'shop2' | 'road' | 'car' | 'person1' | 'person2' | 'person3';

type Part =
  | { k: 'rect'; x: number; y: number; w: number; h: number; rx?: number; fill?: string }
  | { k: 'circle'; cx: number; cy: number; r: number; fill?: string; skin?: string }
  | { k: 'path'; d: string };

export interface Region {
  id: RegionId;
  label: string;
  kind: RegionKind;
  /** People and things can be marked as objects; the sky and the road are background. */
  detectable: boolean;
  d: string;
  box: Box;
  z: number;
  gaps: Gap[];
  /** Only the top `partial` units are found at first (Person 3 in the sample clip). */
  partial?: number;
  /** Index into SAMPLE_COLORS: the five objects the sample clip's detection finds. */
  sample?: number;
  base: { gray: string; color: string };
  parts: Part[];
}

const rect = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}z`;
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

const P1 = 'M370 480h140a30 30 0 0 1 30 30v330H340V510a30 30 0 0 1 30-30z';
const P2 = 'M1545 448h130a30 30 0 0 1 30 30v360h-190V478a30 30 0 0 1 30-30z';
const P3 = 'M1820 508h100a26 26 0 0 1 26 26v300h-152V534a26 26 0 0 1 26-26z';
/* body (820..1340 × 610..760, rx 40) ∪ roof (900..1230 × 540..650, rx 40) ∪ both wheels (r 42 at y 770) */
const CAR = 'M900 580a40 40 0 0 1 40-40h250a40 40 0 0 1 40 40v30h70a40 40 0 0 1 40 40v70a40 40 0 0 1-40 40h-19'
  + 'a42 42 0 1 1-82 0H951a42 42 0 1 1-82 0h-9a40 40 0 0 1-40-40v-70a40 40 0 0 1 40-40h40z';

const GRAY = { sky: '#8A8D93', far: '#6E7178', shop2: '#7B7E85', road: '#4B4E55' };
const COLOR = { sky: '#9DB7D6', far: '#7E8A99', shop2: '#B8A894', road: '#53575F' };
const OFF = { p1: '#9A9DA4', shop: '#7B7E85', car: '#7D8088', p2: '#A7AAB1', p3: '#8E9198' };
const same = (c: string) => ({ gray: c, color: c });
const far = { gray: GRAY.far, color: COLOR.far };
const building = (n: number, x: number, y: number, w: number, h: number): Region => ({
  id: ('building' + n) as RegionId, label: 'Building ' + n, kind: 'building', detectable: true,
  d: rect(x, y, w, h), box: [x, y, x + w, y + h], z: 1, gaps: [], base: far, parts: [{ k: 'rect', x, y, w, h }],
});

/** In paint order (back to front). */
export const REGIONS: readonly Region[] = [
  { id: 'sky', label: 'Sky', kind: 'sky', detectable: false, d: rect(0, 0, 2100, 520), box: [0, 0, 2100, 520], z: 0, gaps: [],
    base: { gray: GRAY.sky, color: COLOR.sky }, parts: [{ k: 'rect', x: 0, y: 0, w: 2100, h: 520 }] },
  // all four sit inside the 16:9 crop (format.ts CROP, x 310-1990) that every thumbnail and the Colorize / Mood
  // frames show, so a marked building is seen and coloured everywhere; Building 2 stands in the gap between the shops
  building(1, 340, 80, 200, 470),
  building(2, 905, 110, 250, 440),
  building(3, 1480, 120, 240, 430),
  building(4, 1740, 200, 240, 350),
  { id: 'shop', label: 'Shopfront', kind: 'shop', detectable: true, d: rect(580, 230, 300, 320), box: [580, 230, 880, 550], z: 2, gaps: [],
    sample: 1, base: same(OFF.shop), parts: [{ k: 'rect', x: 580, y: 230, w: 300, h: 320 }] },
  { id: 'shop2', label: 'Shopfront 2', kind: 'shop', detectable: true, d: rect(1180, 190, 260, 360), box: [1180, 190, 1440, 550], z: 2,
    gaps: [[.1, .24]], base: { gray: GRAY.shop2, color: COLOR.shop2 }, parts: [{ k: 'rect', x: 1180, y: 190, w: 260, h: 360 }] },
  { id: 'road', label: 'Road', kind: 'road', detectable: false, d: rect(0, 550, 2100, 350), box: [0, 550, 2100, 900], z: 2, gaps: [],
    base: { gray: GRAY.road, color: COLOR.road }, parts: [{ k: 'rect', x: 0, y: 550, w: 2100, h: 350 }] },
  { id: 'car', label: 'Car', kind: 'car', detectable: true, d: CAR, box: [820, 540, 1340, 812], z: 3, gaps: [[0, .08]], sample: 2,
    base: same(OFF.car), parts: [
      { k: 'rect', x: 820, y: 610, w: 520, h: 150, rx: 40 }, { k: 'rect', x: 900, y: 540, w: 330, h: 110, rx: 40 },
      { k: 'circle', cx: 910, cy: 770, r: 42, fill: '#303238' }, { k: 'circle', cx: 1240, cy: 770, r: 42, fill: '#303238' }] },
  { id: 'person1', label: 'Person 1', kind: 'person', detectable: true, d: circle(440, 420, 46) + P1, box: [340, 374, 540, 840], z: 4,
    gaps: [[.62, .665]], sample: 0, base: same(OFF.p1), parts: [{ k: 'circle', cx: 440, cy: 420, r: 46, skin: '#E9C2A6' }, { k: 'path', d: P1 }] },
  { id: 'person2', label: 'Person 2', kind: 'person', detectable: true, d: circle(1610, 390, 44) + P2, box: [1515, 346, 1705, 838], z: 4,
    gaps: [[.30, .37]], sample: 3, base: same(OFF.p2), parts: [{ k: 'circle', cx: 1610, cy: 390, r: 44, skin: '#C99A7C' }, { k: 'path', d: P2 }] },
  { id: 'person3', label: 'Person 3', kind: 'person', detectable: true, d: circle(1870, 460, 36) + P3, box: [1794, 424, 1946, 834], z: 4,
    gaps: [[0, .20], [.45, .70], [.86, 1]], partial: 216, sample: 4, base: same(OFF.p3),
    parts: [{ k: 'circle', cx: 1870, cy: 460, r: 36, skin: '#D9A98A' }, { k: 'path', d: P3 }] },
];

export const REGION = Object.fromEntries(REGIONS.map(r => [r.id, r])) as Record<RegionId, Region>;
export const isRegionId = (v: unknown): v is RegionId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(REGION, v);
/** The five regions the sample clip's detection finds, in object-id order (Person 1, Shopfront, Car, Person 2, Person 3). */
export const SAMPLE_REGIONS: readonly RegionId[] = ['person1', 'shop', 'car', 'person2', 'person3'];

/* ---------- Shapes (an object's mask: a region of the table, or a custom polygon drawn in Detect) ---------- */
export type Shape = { kind: 'region'; id: RegionId } | { kind: 'poly'; pts: number[] };
export const W = 2100, H = 900, MAX_POINTS = 64;

export const polyPath = (pts: readonly number[]) => {
  let d = '';
  for (let i = 0; i < pts.length; i += 2) d += (i ? 'L' : 'M') + pts[i] + ' ' + pts[i + 1];
  return d + 'Z';
};
export const shapePath = (s: Shape) => (s.kind === 'region' ? REGION[s.id].d : polyPath(s.pts));
export function shapeBox(s: Shape): Box {
  if (s.kind === 'region') return [...REGION[s.id].box] as Box;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let i = 0; i < s.pts.length; i += 2) {
    x0 = Math.min(x0, s.pts[i]); x1 = Math.max(x1, s.pts[i]); y0 = Math.min(y0, s.pts[i + 1]); y1 = Math.max(y1, s.pts[i + 1]);
  }
  return [x0, y0, x1, y1];
}
/** Regions painted in front of this one (they hide part of it). */
export const frontOf = (id: RegionId) => {
  const r = REGION[id];
  return REGIONS.filter(o => o.z > r.z && o.box[0] < r.box[2] && o.box[2] > r.box[0] && o.box[1] < r.box[3] && o.box[3] > r.box[1]);
};

/** The FrontMasks (parts/ShapeMasks.tsx) mask for this region's visible part, or none when nothing stands in front. */
export const maskUrl = (prefix: string, id: RegionId) => (frontOf(id).length ? `url(#${prefix}-${id})` : undefined);

/** Integers inside the viewBox, at most MAX_POINTS points (evenly thinned), repeated points dropped; null if fewer than 3 remain or it has no area. */
export function boundPoly(raw: readonly number[]): number[] | null {
  if (raw.length % 2 || raw.length < 6 || !raw.every(n => typeof n === 'number' && Number.isFinite(n))) return null;
  let pts: number[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const x = Math.min(W, Math.max(0, Math.round(raw[i]))), y = Math.min(H, Math.max(0, Math.round(raw[i + 1])));
    if (pts.length && pts[pts.length - 2] === x && pts[pts.length - 1] === y) continue;
    pts.push(x, y);
  }
  if (pts.length > 2 && pts[0] === pts[pts.length - 2] && pts[1] === pts[pts.length - 1]) pts = pts.slice(0, -2);
  const n = pts.length / 2;
  if (n > MAX_POINTS) {
    const out: number[] = [];
    for (let k = 0; k < MAX_POINTS; k++) { const i = Math.floor((k * n) / MAX_POINTS) * 2; out.push(pts[i], pts[i + 1]); }
    pts = out;
  }
  if (pts.length < 6) return null;
  // a polygon with no area (all points on one line) marks nothing
  let a = 0;
  for (let i = 0; i < pts.length; i += 2) { const j = (i + 2) % pts.length; a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1]; }
  return a !== 0 ? pts : null;
}

/* ---------- Add by name ---------- */
const ALIASES: Record<RegionKind, readonly string[]> = {
  person: ['person', 'persons', 'people', 'man', 'men', 'woman', 'women', 'human', 'humans', 'pedestrian', 'pedestrians', 'figure', 'figures'],
  shop: ['shop', 'shops', 'store', 'stores', 'shopfront', 'shopfronts', 'storefront', 'storefronts', 'shop front', 'store front'],
  car: ['car', 'cars', 'vehicle', 'vehicles', 'auto', 'automobile', 'automobiles', 'taxi'],
  building: ['building', 'buildings', 'tower', 'towers', 'house', 'houses', 'block', 'blocks', 'skyscraper', 'skyscrapers'],
  sky: [], road: [],
};
export const KIND_NOUN: Record<RegionKind, [string, string]> = {
  person: ['person', 'people'], shop: ['shopfront', 'shopfronts'], car: ['car', 'cars'], building: ['building', 'buildings'],
  sky: ['sky', 'skies'], road: ['road', 'roads'],
};
/** Names compared loosely (case, punctuation and spacing ignored). */
export const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** The detectable regions a typed name finds: an exact label ("building 2") finds that one; otherwise every
 *  region whose kind has a matching alias ("buildings", "the shop", "a tower"). */
export function findRegions(text: string): Region[] {
  const q = norm(text);
  if (!q) return [];
  // a numbered name ("building 2", "person 3") means that one; a plain name ("shopfront") means every one of its kind
  const exact = /\d/.test(q) ? REGIONS.filter(r => r.detectable && norm(r.label) === q) : [];
  if (exact.length) return exact;
  const padded = ' ' + q + ' ';
  const kinds = new Set((Object.keys(ALIASES) as RegionKind[]).filter(k => ALIASES[k].some(a => padded.includes(' ' + a + ' '))));
  return REGIONS.filter(r => r.detectable && kinds.has(r.kind));
}
