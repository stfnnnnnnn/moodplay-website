import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as RMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import './tour.css';
import { useDemo } from '../store';
import { go, type Screen } from '../nav';
import { prefersReducedMotion } from '../ui';
import { N, NAMES, STEPS, deepLinkStep, stepFor, type TourStep } from './steps';
import { useSpotlight } from './useSpotlight';

/* The 26-step guided tour (docs/design/tutorial-v5.md), ported from the mockups' engine
   (docs/design/tools/mockup-sources/tour/engine.html) to the SPA:
   - progress lives in the demo store (sessionStorage mp-demo-v1: tour = {active, step}; active false = paused);
   - the tour moves between screens itself (demo nav); a navigation the page makes (a step's own button,
     Render opening Results, browser Back) carries it to that screen's first step;
   - the URL keeps ?tour=n in step (replaceState), so a reload lands on the same step.
   The spotlight, inert lock, measuring and card placement are in useSpotlight. */

/** The step as shown: the Home empty-state variant replaces step 1 while the first-run panel is visible. */
function effective(i: number): TourStep {
  const s = STEPS[i];
  if (!s?.empty) return s;
  const w = document.querySelector(s.empty.when);
  if (!w || !w.getClientRects().length) return s;
  const o: TourStep = { ...s, act: undefined, doSel: undefined, doIt: undefined, stay: undefined, wait: undefined };
  return { ...o, ...s.empty };
}
const visibleEl = (el: Element | null): el is HTMLElement => {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
};
const usable = (el: Element | null): el is HTMLElement => visibleEl(el) && !(el as HTMLButtonElement).disabled;

function setUrlStep(n: number | null) {
  try {
    const u = new URL(location.href);
    if (n == null) u.searchParams.delete('tour'); else u.searchParams.set('tour', String(n));
    if (u.href !== location.href) history.replaceState(history.state, '', u.href);
  } catch { /* ignore */ }
}

/** Page panels that handle their own Escape before the tour pauses. */
const PAGE_OVERLAYS = '.boardwrap.open';

interface CardView { n: number; s: TourStep; fallback: boolean }

export function Tour({ screen }: { screen: Screen }) {
  const { state, dispatch, current } = useDemo();
  const tour = state.tour;
  const active = !!tour?.active, paused = !!tour && !tour.active;
  const step = tour?.step ?? 1;
  const onScreen = active && STEPS[step - 1].screens.includes(screen);

  const [view, setView] = useState<CardView | null>(null);
  const [live, setLive] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const spot = useSpotlight(cardRef, rootRef);
  const hadCard = useRef(false);
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  // refs read by document listeners
  const S = useRef({ step, active, screen, onScreen, advancing: false, navTo: null as Screen | null, prevScreen: null as Screen | null, token: 0 });
  useEffect(() => { Object.assign(S.current, { step, active, screen, onScreen }); });
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const pauseRef = useRef<() => void>(() => {}); // pause(), for the hold's stall timeout (set below)
  const currentRef = useRef(current);
  useEffect(() => { currentRef.current = current; }, [current]);

  // ?tour=n on load: DemoApp applies it after this component's first effects run, so wait for it (a stored
  // step from earlier in the session must not open its own screen first)
  const urlStep = useRef<number | null>(deepLinkStep(location.search));
  const waitingForUrl = (isActive: boolean, n: number) => {
    const u = urlStep.current;
    if (u == null) return false;
    if (isActive && n === u) { urlStep.current = null; return false; }
    return true;
  };

  const setStep = useCallback((n: number, act = true) => dispatch({ type: 'tour', step: n, active: act }), [dispatch]);

  /* ---------- navigation: the tour opens a step's screen itself ---------- */
  const navigateTo = useCallback((n: number) => {
    const s = STEPS[n - 1], target = s.screens[0], st = stateRef.current;
    S.current.navTo = target;
    if (target === 'detect' || target === 'colorize' || target === 'mood' || target === 'render' || target === 'results') {
      // the tour runs on the sample project (made once, then reused), so the user's own projects don't change
      const cur = currentRef.current;
      if (!cur || !cur.isSample) dispatch({ type: 'createSample' });
      if (target === 'results') {
        const sample = st.projects.find(p => p.isSample);
        // Results need a render: leaving the (frozen) render by Next means it finished
        if (!sample || (!sample.renders.length && !sample.finished)) dispatch({ type: 'finishRender' });
      }
      go(target, { tour: n });
    } else if (target === 'project') {
      const cur = currentRef.current, list = st.projects;
      const p = (cur && cur.renders.length ? cur : null) ?? list.find(x => x.renders.length) ?? cur ?? list[0];
      if (!p) { S.current.navTo = null; setStep(n + 1 <= N ? n + 1 : n); return; } // no project at all: skip step 25
      go('project', { id: p.id, tour: n });
    } else {
      go(target, { tour: n });
    }
  }, [dispatch, setStep]);

  // keep the tour and the screen together
  useEffect(() => {
    const r = S.current, prev = r.prevScreen;
    r.prevScreen = screen;
    if (!active) { r.navTo = null; return; }
    if (waitingForUrl(active, step)) return;
    if (onScreen) { r.navTo = null; return; }
    if (screen === 'intro') return; // the first-run intro has no steps; its Start tutorial carries on
    if (r.navTo) { if (r.navTo === screen) r.navTo = null; else return; }
    if (prev && prev !== screen) {
      // the page navigated (a step's own button, Render opening Results, Back): continue at this screen's first step
      r.advancing = false;
      setStep(stepFor(step, screen));
      return;
    }
    navigateTo(step);
  }, [active, onScreen, screen, step, navigateTo, setStep]);

  /* ---------- showing a step ---------- */
  const [nonce, setNonce] = useState(0); // re-show the same step (Home: after the sample project is made)
  useLayoutEffect(() => {
    const waiting = waitingForUrl(active, step);
    if (!onScreen || waiting) {
      // between screens the scrim and the lock stay up (tutorial-v5.md: the scrim is static); only the card leaves
      if (active && hadCard.current && !waiting && screen !== 'intro') {
        const my = ++S.current.token;
        // a navigation that never lands must not leave the page locked: pause (Resume chip, Esc and End work again)
        spot.hold(prefersReducedMotion(), () => { if (my === S.current.token && !S.current.onScreen) pauseRef.current(); });
      }
      else { spot.hide(); hadCard.current = false; }
      return;
    }
    const my = ++S.current.token, n = step, reduce = prefersReducedMotion();
    S.current.advancing = false;
    setUrlStep(n);
    const first = !hadCard.current;
    hadCard.current = true;
    const timers: number[] = [];
    const run = () => {
      if (my !== S.current.token) return;
      // Upload settings steps need a clip: add the sample (as step 4 does) when there is none yet
      const s0 = STEPS[n - 1];
      if (s0.needsClip && document.querySelector('.v5 main[data-state="empty"]')) document.querySelector<HTMLElement>('[data-tour="tut_sample_btn"]')?.click();
      timers.push(window.setTimeout(() => {
        if (my !== S.current.token) return;
        const s = effective(n - 1);
        const actEl = s.act ? document.querySelector(s.doSel ?? s.act) ?? document.querySelector(s.act) : null;
        const fallback = !!s.act && !usable(actEl);
        setView({ n, s, fallback });
        const say = `Step ${n} of ${N}. ${s.t}. ${s.b}` + (s.doIt && !fallback ? ` ${s.doIt}, or press Next.` : '');
        // announced once the card is in (the live region is mounted with the tour, outside the hidden layer)
        spot.show(s, { first, reduce, isCurrent: () => my === S.current.token, onEnter: () => setLive(say) });
      }, s0.needsClip ? 60 : 0));
    };
    if (first) run();
    else { spot.leave(reduce); timers.push(window.setTimeout(run, reduce ? 0 : 100)); } // the card is nearly gone; the spotlight moves on
    return () => timers.forEach(t => window.clearTimeout(t));
    // spot is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onScreen, step, nonce, screen]);

  // tour gone or paused: restore the page
  useEffect(() => {
    if (active) return;
    spot.hide();
    S.current.token++;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  useEffect(() => {
    const r = S.current;
    return () => { r.token++; spot.hide(); };
  }, [spot]);

  /* ---------- actions ---------- */
  const end = useCallback(() => {
    S.current.token++;
    spot.hide();
    setView(null);
    dispatch({ type: 'tour', step: null });
    setUrlStep(null);
    // hand focus back to where the tour can be restarted (Tutorial on Home / Projects / a project page); the step
    // pages have no Tutorial button, so there it goes to the page heading
    requestAnimationFrame(() => {
      const t = document.querySelector<HTMLElement>('.v5 .tut') ?? document.querySelector<HTMLElement>('.v5 main h1, .v5 main h2');
      if (t && !t.matches('a,button') && !t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t?.focus({ preventScroll: true });
    });
  }, [dispatch, spot]);

  const goStep = useCallback((n: number) => {
    if (n < 1) return;
    if (n > N) { end(); return; }
    setStep(n);
  }, [setStep, end]);

  const next = useCallback(() => {
    const v = viewRef.current;
    if (!v || S.current.advancing) return;
    const s = v.s;
    if (s.end) { end(); go('upload'); return; }
    if (s.act && s.kind !== 'go') {
      const el = document.querySelector(s.doSel ?? s.act) ?? document.querySelector(s.act);
      if (usable(el)) { el.click(); return; } // the click handler below advances (or the page navigates)
    }
    goStep(v.n + 1);
  }, [end, goStep]);
  const back = useCallback(() => { const v = viewRef.current; if (v) goStep(v.n - 1); }, [goStep]);

  const pause = useCallback(() => {
    const v = viewRef.current;
    S.current.token++;
    spot.hide();
    setView(null);
    setStep(v?.n ?? S.current.step, false);
    requestAnimationFrame(() => chipRef.current?.focus({ preventScroll: true }));
  }, [setStep, spot]);
  useEffect(() => { pauseRef.current = pause; }, [pause]);
  const resume = () => setStep(stepFor(step, screen));

  /* acting on the spotlit control advances the tour; Detect objects is carried by the tour itself */
  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      const v = viewRef.current, r = S.current;
      if (!v || r.advancing || !(e.target instanceof Element)) return;
      // a modified click (new tab or window) leaves the page where it is: not the act
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const s = v.s;
      if (!s.act || !e.target.closest(s.act)) return;
      if (s.kind === 'go') { e.preventDefault(); e.stopImmediatePropagation(); r.advancing = true; goStep(v.n + 1); return; }
      r.advancing = true;
      if (s.kind === 'nav') { spot.leave(prefersReducedMotion()); return; } // the page navigates; the screen effect moves the tour on
      const at = v.n, tok = r.token;
      window.setTimeout(() => {
        if (S.current.token !== tok || S.current.step !== at || !S.current.active) return;
        if (s.stay) setNonce(x => x + 1); else goStep(at + 1);
      }, s.wait ?? 350);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active, goStep, spot]);

  /* keys: Esc pauses from anywhere (the colour picker closes first: it stops Escape in the window's capture
     phase); → / Enter (card focused) next and ← back only while focus is in the card; Tab stays in the card
     and the lit target */
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (!viewRef.current || !S.current.onScreen) return;
      const card = cardRef.current;
      if (e.key === 'Escape') {
        // a panel the page opened inside the lit target closes first (Mood's larger preview), as the colour picker does
        if (e.target instanceof Element && e.target.closest(PAGE_OVERLAYS)) return;
        e.preventDefault(); e.stopPropagation(); pause(); return;
      }
      if (e.key === 'Tab' && card) {
        const a = document.activeElement;
        if (a instanceof Element && a.closest('.cpop')) return; // the colour picker manages its own Tab
        const pool = [card, ...spot.focusables(), ...card.querySelectorAll<HTMLElement>('button:not([hidden])')];
        const ordered = [...new Set(pool)].filter(el => el === card || visibleEl(el))
          .sort((x, y) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        const list = ordered.filter(el => el !== card);
        if (!list.length) { e.preventDefault(); card.focus(); return; }
        const i = list.indexOf(a as HTMLElement);
        const nextEl = e.shiftKey ? (i <= 0 ? list[list.length - 1] : list[i - 1]) : (i < 0 || i === list.length - 1 ? list[0] : list[i + 1]);
        e.preventDefault(); nextEl.focus();
        return;
      }
      if (!card || !card.contains(document.activeElement)) return;
      if (e.key === 'ArrowRight' || (e.key === 'Enter' && document.activeElement === card)) { e.preventDefault(); e.stopPropagation(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); back(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [active, pause, next, back, spot]);

  /* ---------- render: a layer of its own on body (a .v5 host, so the scoped styles apply) ---------- */
  const showChip = paused && screen !== 'intro';
  if (!active && !showChip) return null;
  let body;
  if (showChip) {
    const n = stepFor(step, screen);
    body = (
      <div className="tour-chip" role="group" aria-label="Tutorial paused">
        <button ref={chipRef} type="button" className="tour-btn tour-resume" onClick={resume}>Resume tour<span>Step {n} of {N}</span></button>
        <button type="button" className="tour-btn tour-end" aria-label="End tutorial" onClick={end}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
    );
  } else {
    // the last step's content stays on the card while it fades out between screens
    const v = view;
    const pageSteps = v ? STEPS.map((x, i) => ({ x, i })).filter(o => o.x.page === v.s.page) : [];
    const nx = v ? STEPS[v.n] : undefined;
    const nextLabel = !v ? 'Next' : v.s.end ? 'Start your own video' : nx && nx.page !== v.s.page ? 'Next: ' + NAMES[nx.page] : 'Next';
    const keepFocus = (e: RMouseEvent) => { e.preventDefault(); cardRef.current?.focus({ preventScroll: true }); };
    body = (
      <>
        <div className="tour-root" ref={rootRef}>
          {(['t', 'r', 'b', 'l', 'h'] as const).map(k => <div key={k} className="tour-blk" data-b={k} onMouseDown={keepFocus} />)}
          <div className="tour-scrim" aria-hidden="true" />
          <div className="tour-ring o" aria-hidden="true" />
          <div className="tour-ring i" aria-hidden="true" />
          <div ref={cardRef} className={'tour-card' + (v?.s.end ? ' end' : '')} role="dialog" aria-modal="false" aria-label="Tutorial" tabIndex={-1}>
            {v && (
              <>
                <div className="tour-top">
                  <span>{NAMES[v.s.page]}</span>
                  <span className="tour-dots" aria-hidden="true">{pageSteps.map(o => <i key={o.i} className={o.i + 1 < v.n ? 'd' : o.i + 1 === v.n ? 'c' : undefined} />)}</span>
                  <span className="tour-count">Step {v.n} of {N}</span>
                </div>
                <h2 className="tour-t">{v.s.t}</h2>
                <p className="tour-b">{v.s.b}</p>
                {v.s.doIt && !v.fallback && <p className="tour-do">{v.s.doIt}</p>}
                <div className="tour-foot">
                  <button type="button" className="tour-btn tour-skip" onClick={end}>{v.s.end ? 'Close' : 'Skip tour'}</button>
                  <span className="tour-g" />
                  {v.n > 1 && <button type="button" className="tour-btn tour-back" onClick={back}>Back</button>}
                  <button type="button" className="tour-btn tour-next" onClick={next}>{nextLabel}</button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="sr" aria-live="polite">{live}</div>
      </>
    );
  }
  return createPortal(<div className="v5 tour-host">{body}</div>, document.body);
}
