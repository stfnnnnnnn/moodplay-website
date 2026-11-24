import { useEffect, useRef } from 'react';

/* "Stop …?" ask-first block shared by Detect (Stop detecting) and Render (Cancel render), ruling R8.
   On open it focuses the keep button; Escape or the keep button carries on (onKeep returns focus to the button
   that opened it); the stop button is the quiet pink-outline .btn-stop (never a second pink filled button). */

export function StopConfirm({ id, title, text, keepLabel, stopLabel, onKeep, onStop }: {
  id: string; title: string; text: string; keepLabel: string; stopLabel: string; onKeep: () => void; onStop: () => void;
}) {
  const keepBtn = useRef<HTMLButtonElement>(null);
  const keepFn = useRef(onKeep);
  useEffect(() => { keepFn.current = onKeep; }, [onKeep]);
  useEffect(() => {
    const raf = requestAnimationFrame(() => keepBtn.current?.focus());
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); keepFn.current(); } };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); };
  }, []);
  return (
    <div className="confirm" role="group" aria-labelledby={id}>
      <b id={id}>{title}</b>
      <p>{text}</p>
      <div className="acts">
        <button ref={keepBtn} className="btn btn-ghost" type="button" onClick={onKeep}>{keepLabel}</button>
        <button className="btn btn-stop" type="button" onClick={onStop}>{stopLabel}</button>
      </div>
    </div>
  );
}
