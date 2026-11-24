import { Fragment, useEffect, useRef } from 'react';
import { STEP_NAMES, useDemo, type Step } from '../store';
import { STEP_SCREENS, demoHref, linkClick } from '../nav';

/** Step rail for the step pages: done = blue check (links back), now = pink pill, lock = muted.
 *  `reached` is the furthest step the project has reached (5 when finished).
 *  `lockPast` locks the done steps too (while a render runs, leaving would stop it; v5-render.html).
 *  `nowNote` is screen-reader text after the current step, e.g. " (rendering)". */
export function StepRail({ now, reached, lockPast, nowNote }: { now: Step; reached: Step; lockPast?: boolean; nowNote?: string }) {
  const { current } = useDemo();
  // when the rail is wider than its slot (it scrolls sideways), keep the current step in view, centred (clear of the
  // 28px edge fades).
  // Measured in a ResizeObserver callback, not in the commit: it runs after the browser's own layout and before
  // paint (no forced layout while React commits, no visible jump), on first observe and whenever the rail resizes.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === 'undefined') return;
    // which edge(s) hide more steps: the CSS fades those edges so no label ends in a hard cut
    const edges = () => {
      const l = nav.scrollLeft > 1, r = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1;
      const v = (l ? 'l' : '') + (r ? 'r' : '');
      if (v) nav.dataset.fade = v; else delete nav.dataset.fade;
    };
    const fit = () => {
      const cur = nav.querySelector('[aria-current="step"]');
      if (cur && nav.scrollWidth > nav.clientWidth + 1) {
        const n = nav.getBoundingClientRect(), c = cur.getBoundingClientRect();
        if (c.left < n.left + 32 || c.right > n.right - 32) nav.scrollLeft += c.left + c.width / 2 - (n.left + n.width / 2);
      }
      edges();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(nav);
    nav.addEventListener('scroll', edges, { passive: true });
    return () => { ro.disconnect(); nav.removeEventListener('scroll', edges); };
  }, [now]);
  return (
    <nav aria-label="Steps" ref={navRef}>
      <ol className="rail">
        {STEP_NAMES.map((name, i) => {
          const n = (i + 1) as Step;
          const state = n === now ? 'now' : n <= reached && !lockPast ? 'done' : 'lock';
          const screen = STEP_SCREENS[i];
          // Upload opens the project's own clip (?id=); without an id Upload starts a new video
          const params = screen === 'upload' && current ? { id: current.id } : undefined;
          return (
            <Fragment key={name}>
              {i > 0 && <li className="sep" aria-hidden="true" />}
              <li className={state === 'lock' && lockPast && n <= reached ? 'done lock' : state}>
                {state === 'now' && <a href={demoHref(screen, params)} aria-current="step" onClick={e => e.preventDefault()}>{name}{nowNote && <span className="sr">{nowNote}</span>}</a>}
                {state === 'done' && <a href={demoHref(screen, params)} onClick={linkClick(screen, params)}>{name}<span className="sr">, done</span></a>}
                {state === 'lock' && <a aria-disabled="true" title={lockPast && n < now ? 'Cancel the render to change this step' : undefined}>{name}</a>}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
