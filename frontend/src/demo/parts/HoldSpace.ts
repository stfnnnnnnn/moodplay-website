import { useCallback, useEffect, useState, type PointerEvent as RPointerEvent } from 'react';

/* Hold Space (or press and hold the top-bar eye button, for touch) to see the black-and-white original
   (v5-colorize.html / v5-mood.html). Typing fields, sliders, links and other buttons keep Space;
   a focused hold button is still held by Space. Released on keyup, pointer up/cancel and window blur. */

const keepsSpace = (t: EventTarget | null) =>
  t instanceof Element && t.matches('input,textarea,select,[contenteditable],[role=slider],[role=radio],button:not(#hold),a[href]');

export function useHoldSpace() {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code !== 'Space' || keepsSpace(e.target)) return; e.preventDefault(); if (!e.repeat) setHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.code !== 'Space') return; if (!keepsSpace(e.target)) e.preventDefault(); setHeld(false); };
    const blur = () => setHeld(false);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);
  const release = useCallback(() => setHeld(false), []);
  /** Props for the hold button: press and hold shows the original, letting go shows the colours again. */
  const bind = {
    onPointerDown: (e: RPointerEvent<HTMLButtonElement>) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } setHeld(true); },
    onPointerUp: release, onPointerCancel: release, onLostPointerCapture: release,
    onClick: (e: { preventDefault: () => void }) => e.preventDefault(),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };
  return { held, bind };
}
