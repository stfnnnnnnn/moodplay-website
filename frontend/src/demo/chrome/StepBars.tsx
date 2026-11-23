import type { Project } from '../store';
import { STEP_NAMES } from '../store';

/** Five small step bars (owner rule 8): done = blue, current = pink, locked = grey. Decorative; pair with StepLabel. */
export function StepBars({ project, className }: { project: Pick<Project, 'step' | 'finished'>; className?: string }) {
  const { step, finished } = project;
  return (
    <span className={'sbars' + (className ? ' ' + className : '')} aria-hidden="true">
      {STEP_NAMES.map((n, i) => <i key={n} className={finished || i + 1 < step ? 'd' : i + 1 === step ? 'n' : undefined} />)}
    </span>
  );
}

/** "Done" or the current step name, with screen-reader detail. */
export function StepLabel({ project, className = 'st' }: { project: Pick<Project, 'step' | 'finished'>; className?: string }) {
  return project.finished
    ? <span className={className + ' done'}>Done<span className="sr">, all 5 steps</span></span>
    : <span className={className}>{STEP_NAMES[project.step - 1]}<span className="sr">, step {project.step} of 5</span></span>;
}
