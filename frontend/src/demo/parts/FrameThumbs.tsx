import { Scene } from '../scene';
import { CROP } from '../format';
import type { MoodKey, SceneObject } from '../store';

/* The Colorize and Mood filmstrip: ten frame thumbnails. Clicking one moves the header's frame number and time
   code to that frame (the viewer itself is one still). Mood passes its grade; Colorize shows the colours only. */

const FRAMES = [0, 32, 48, 64, 96, 128, 160, 192, 224, 256];

export function FrameThumbs({ objects, mood = null, at, onPick, label, itemLabel }: {
  objects?: SceneObject[]; mood?: MoodKey | null; at: number; onPick: (f: number) => void;
  /** The group's name ("Frames") and each button's prefix ("Frame "). */
  label: string; itemLabel: string;
}) {
  return (
    <div className="thumbs" role="group" aria-label={label}>
      {FRAMES.map(f => (
        <button key={f} className="th" type="button" aria-label={itemLabel + (f || 1)} aria-current={(f || 1) === at ? 'true' : undefined} onClick={() => onPick(f || 1)}>
          <Scene variant="gray" objects={objects} viewBox={CROP} mood={mood} />
        </button>
      ))}
    </div>
  );
}
