import { TopBar } from '../chrome/TopBar';
import type { Step } from '../store';
import { demoHref, linkClick, type Screen } from '../nav';

/* A step page with nothing to show (no project, or no objects left): the top bar stays, with a short
   message and a way back, instead of a blank page. Reached in practice by Colorize with no objects left and by
   Results for a project with no render; the "no project" uses in Mood, Render and Results are a safety net,
   because DemoApp always opens or creates a project before a step screen renders. */
export function EmptyStep({ step, reached, title, text, to, action }: {
  step: Step; reached?: Step; title: string; text: string; to: Screen; action: string;
}) {
  return (
    <>
      <TopBar kind="step" step={step} reached={reached ?? step} />
      <main className="sp sp-empty">
        <section className="card estep" aria-labelledby="estep-h">
          <h1 id="estep-h">{title}</h1>
          <p>{text}</p>
          <a className="btn btn-line" href={demoHref(to)} onClick={linkClick(to)}>{action}</a>
        </section>
      </main>
    </>
  );
}
