import { memo } from 'react';
import { Scene } from '../scene';
import type { MoodKey, SceneObject } from '../store';

/** n filmstrip cells, each a slice of the scene at its own point in the shot (the mockups pan one still across). */
export const StripFrames = memo(function StripFrames({ n, w = 1000, variant = 'gray', objects, mood, className = 'fcell', cellClass }:
  { n: number; w?: number; variant?: 'gray' | 'color'; objects?: SceneObject[]; mood?: MoodKey | null; className?: string; cellClass?: (i: number) => string }) {
  const cells = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round(n > 1 ? (i / (n - 1)) * (2100 - w) : (2100 - w) / 2);
    cells.push(
      <div key={i} className={className + (cellClass ? ' ' + cellClass(i) : '')}>
        <Scene variant={variant} objects={objects} mood={mood} viewBox={`${x} 0 ${w} 900`} />
      </div>,
    );
  }
  return <>{cells}</>;
});
