import { Fragment } from 'react';
import { STEP_NAMES, type Step } from '../store';
import { STEP_SCREENS, demoHref, linkClick } from '../nav';

/** Step rail for the step pages: done = blue check (links back), now = pink pill, lock = muted.
 *  `reached` is the furthest step the project has reached (5 when finished). */
export function StepRail({ now, reached }: { now: Step; reached: Step }) {
  return (
    <nav aria-label="Steps">
      <ol className="rail">
        {STEP_NAMES.map((name, i) => {
          const n = (i + 1) as Step;
          const state = n === now ? 'now' : n <= reached ? 'done' : 'lock';
          const screen = STEP_SCREENS[i];
          return (
            <Fragment key={name}>
              {i > 0 && <li className="sep" aria-hidden="true" />}
              <li className={state}>
                {state === 'now' && <a href={demoHref(screen)} aria-current="step" onClick={e => e.preventDefault()}>{name}</a>}
                {state === 'done' && <a href={demoHref(screen)} onClick={linkClick(screen)}>{name}<span className="sr">, done</span></a>}
                {state === 'lock' && <a aria-disabled="true">{name}</a>}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
