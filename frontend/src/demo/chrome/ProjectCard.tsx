import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Project } from '../store';
import { Scene } from '../scene';
import { CROP, MOOD_DOT, MOOD_LABEL, mid, plural, realMood, short, shownMood } from '../format';
import { IconDots } from './Icons';
import { StepBars, StepLabel } from './StepBars';

/* Project card (v5-projects-b.html): frame with the picked colours + mood, Finished / In progress,
   renders count, "…" menu, name, mood, date + step bars. */


export function MoodLine({ p }: { p: Project }) {
  const m = realMood(p.mood);
  return m
    ? <><span className="mdot" style={{ background: MOOD_DOT[m] }} /><span>{MOOD_LABEL[m]}</span></>
    : <span>{p.step >= 4 && !p.finished ? 'Mood not picked yet' : 'No mood yet'}</span>;
}

export function Progress({ p, long }: { p: Project; long?: boolean }) {
  return <><span>{long ? 'Opened ' : ''}{short(p.updated)}</span><StepBars project={p} /><StepLabel project={p} /></>;
}

/** The file name, middle-truncated when long; the full name stays for screen readers. */
export function Name({ name, n = 50 }: { name: string; n?: number }) {
  const m = mid(name, n);
  return m === name ? <>{name}</> : <><span aria-hidden="true">{m}</span><span className="sr">{name}</span></>;
}

export interface MenuItem { key: string; label: string; danger?: boolean; sep?: boolean; onSelect: () => void }

/** "…" menu button + popover: arrow keys move, Escape closes and returns focus. */
export function MoreMenu({ items, label, className = 'menu-btn', icon }: { items: MenuItem[]; label: string; className?: string; icon?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onDoc = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);
  const onKey = (e: KeyboardEvent) => {
    const list = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]') ?? [])];
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.current?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };
  return (
    <>
      <button ref={btn} className={className} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={label} onClick={() => setOpen(o => !o)}>
        {icon ?? <IconDots />}
      </button>
      <div ref={menu} id={id} className={'menu' + (open ? '' : ' shut')} role="menu" onKeyDown={onKey}>
        {items.map(it => (
          <div key={it.key} style={{ display: 'contents' }}>
            {it.sep && <hr />}
            <button role="menuitem" type="button" tabIndex={open ? 0 : -1} className={it.danger ? 'mdel' : undefined}
              onClick={() => { setOpen(false); it.onSelect(); }}>{it.label}</button>
          </div>
        ))}
      </div>
    </>
  );
}

export function ProjectCard({ p, onOpen, menu, tourId }: { p: Project; onOpen: () => void; menu: MenuItem[]; tourId?: string }) {
  return (
    <article className="pc" data-id={p.id} data-tour={tourId}>
      <div className="th" data-thumb={p.id}>
        <Scene variant="gray" objects={p.objects} mood={shownMood(p)} viewBox={CROP} />
        <span className={'badge ' + (p.finished ? 'fin' : 'wip')}>{p.finished ? 'Finished' : 'In progress'}</span>
        {p.renders.length > 0 && <span className="chip runs-n">{plural(p.renders.length, 'render', 'renders')}</span>}
      </div>
      <MoreMenu items={menu} label={'More actions for ' + p.name} />
      <div className="info">
        <h2 className="nm"><button className="pc-open" type="button" title={p.name} onClick={onOpen}><Name name={p.name} /></button></h2>
        <div className="md"><MoodLine p={p} /></div>
        <div className="dt"><Progress p={p} /></div>
      </div>
    </article>
  );
}
