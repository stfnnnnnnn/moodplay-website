import { memo } from 'react';
import { SAMPLE_COLORS, isColor, type MoodKey, type SceneObject } from './store';

/* The mockup street scene (scene-gray.svg / scene-color.svg, viewBox 2100×900), drawn inline so each
   object takes the colour picked for it. variant="color" also colours the background (sky, buildings,
   road); variant="gray" keeps the background black and white, as in a frame being colorized. */

const GRAY = { sky: '#8A8D93', far: '#6E7178', shop2: '#7B7E85', road: '#4B4E55' };
const COLOR = { sky: '#9DB7D6', far: '#7E8A99', shop2: '#B8A894', road: '#53575F' };
const SKIN = ['#E9C2A6', '#C99A7C', '#D9A98A'];
const OFF = { p1: '#9A9DA4', shop: '#7B7E85', car: '#7D8088', p2: '#A7AAB1', p3: '#8E9198' };

const P1 = 'M370 480h140a30 30 0 0 1 30 30v330H340V510a30 30 0 0 1 30-30z';
const P2 = 'M1545 448h130a30 30 0 0 1 30 30v360h-190V478a30 30 0 0 1 30-30z';
const P3 = 'M1820 508h100a26 26 0 0 1 26 26v300h-152V534a26 26 0 0 1 26-26z';

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
  const bg = variant === 'color' ? COLOR : GRAY;
  const col = (i: number): string | null => {
    if (!objects) return variant === 'color' ? SAMPLE_COLORS[i] : null;
    const c = objects[i]?.color;
    return isColor(c) ? c : null;
  };
  const [c1, c2, c3, c4, c5] = [0, 1, 2, 3, 4].map(col);
  return (
    <svg className={'scene' + (className ? ' ' + className : '')} viewBox={viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="2100" height="900" fill="#5C5F66" />
      <rect width="2100" height="520" fill={bg.sky} />
      <g fill={bg.far}><rect x="60" y="150" width="260" height="400" /><rect x="340" y="80" width="200" height="470" /><rect x="1480" y="120" width="240" height="430" /><rect x="1740" y="200" width="300" height="350" /></g>
      <rect x="580" y="230" width="300" height="320" fill={c2 ?? OFF.shop} />
      <rect x="1180" y="190" width="260" height="360" fill={bg.shop2} />
      <rect y="550" width="2100" height="350" fill={bg.road} />
      <g fill={c3 ?? OFF.car}><rect x="820" y="610" width="520" height="150" rx="40" /><rect x="900" y="540" width="330" height="110" rx="40" /></g>
      <g fill="#303238"><circle cx="910" cy="770" r="42" /><circle cx="1240" cy="770" r="42" /></g>
      <circle cx="440" cy="420" r="46" fill={c1 ? SKIN[0] : OFF.p1} /><path d={P1} fill={c1 ?? OFF.p1} />
      <circle cx="1610" cy="390" r="44" fill={c4 ? SKIN[1] : OFF.p2} /><path d={P2} fill={c4 ?? OFF.p2} />
      <circle cx="1870" cy="460" r="36" fill={c5 ? SKIN[2] : OFF.p3} /><path d={P3} fill={c5 ?? OFF.p3} />
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
