import { TopBar } from '../chrome/TopBar';
import { Button } from '../chrome/Button';
import { Scene } from '../scene';
import { STEP_NAMES, useDemo, type Step } from '../store';
import { STEP_SCREENS, go, type Screen } from '../nav';

/* Placeholder for a step page until its real screen lands (Tasks 4-6 replace Upload…Results).
   Keeps the flow clickable: previous / next step. */
export default function StepStub({ step, screen, title }: { step: Step; screen: Screen; title?: string }) {
  const { current } = useDemo();
  if (!current) return null;
  const reached = (current.finished ? 5 : Math.max(current.step, step)) as Step;
  const prev = step > 1 ? STEP_SCREENS[step - 2] : null;
  const next: Screen | null = screen === 'mood' ? 'render' : screen === 'render' ? 'results' : step < 5 ? (STEP_SCREENS as readonly Screen[])[step] : null;
  return (
    <>
      <TopBar kind="step" step={step} reached={reached} />
      <main className="stub">
        <div className="viewer"><Scene variant="gray" objects={current.objects} mood={step >= 4 ? current.mood : null} /></div>
        <section className="card" aria-labelledby="stub-h">
          <h1 id="stub-h" style={{ fontSize: 24 }}>{title ?? STEP_NAMES[step - 1]}</h1>
          <p>{current.name}. This step page is still being built.</p>
          <div className="acts">
            {prev && <Button variant="ghost" onClick={() => go(prev)}>Back</Button>}
            {next && <Button variant="pink" onClick={() => go(next)}>Continue</Button>}
          </div>
        </section>
      </main>
    </>
  );
}
