import type { useHoldSpace } from '../parts/HoldSpace';

/* Top-bar "Hold Space for original" (Colorize and Mood only, owner rule 5). Below 900px only the eye shows;
   on touch, press and hold it. Not pink: the top bar never uses pink. */
export function HoldButton({ hold }: { hold: ReturnType<typeof useHoldSpace> }) {
  return (
    <>
      <button className="btn btn-ghost hold" id="hold" type="button" aria-pressed={hold.held} aria-describedby="holdD"
        aria-label="Hold Space for original" data-tour="tut_hold" {...hold.bind}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
        <span className="hl" aria-hidden="true">Hold <span className="kbd">Space</span> for original</span>
      </button>
      <span id="holdD" hidden>Press and hold this button, or hold the Space key, to see the black-and-white original.</span>
    </>
  );
}
