import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent, type RefObject } from 'react';
import './steps.css';
import './upload.css';
import { TopBar } from '../chrome/TopBar';
import { Scene } from '../scene';
import { useDemo } from '../store';
import { go, type ScreenProps } from '../nav';
import { InfoButton } from '../parts/InfoTip';
import { useInfoTips } from '../parts/useInfoTips';
import { StripFrames } from '../parts/StripFrames';
import { flow, reachedFor } from '../parts/flow';
import { useDemoUi } from '../ui';
import { CLIP, CLIP_SIZE, clipTime, num as n } from '../format';

/* Upload (v5-upload.html): drop zone (a real file is accepted, only its name is kept), the file card,
   filmstrip preview + scrub, and every setting from pages/upload.py with its help behind an info button.
   No trim handle (ruling R1): "Process full video" off shows only the "Max frames to process" slider.
   A project is created only when you click "Detect objects" (never on pick), so removing and re-adding a clip
   cannot make duplicates. The clip facts come from format.ts CLIP (ruling R9). */

const DUR = CLIP.seconds, FPS = CLIP.fps, FRAMES = CLIP.frames;
const VIDEO = /\.(mp4|mov|avi)$/i;
const SAMPLE_CLIP = 'harbour-street-1952.mp4';
const SCENES = ['Urban street', 'Office workspace', 'Bedroom', 'Living room', 'Nature trail', 'Market', 'Café or dining room'];
const fmt = clipTime;

interface Settings { scene: string; res: '720' | '480'; bw: boolean; stride: number; nfr: number; batch: boolean; chunk: number; full: boolean; maxf: number }
const DEFAULTS: Settings = { scene: SCENES[0], res: '720', bw: true, stride: 4, nfr: 30, batch: true, chunk: 16, full: true, maxf: 180 };
const MAXF = { min: 30, max: 600, step: 10 };

export default function Upload({ id }: ScreenProps) {
  const { state, dispatch } = useDemo();
  const { toast } = useDemoUi();
  const opened = id ? state.projects.find(p => p.id === id) ?? null : null;
  const [file, setFile] = useState<{ name: string; size: number | null } | null>(() => (opened ? { name: opened.name, size: null } : null));
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [over, setOver] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);
  const chooseBtn = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);
  const tag = useRef<HTMLSpanElement>(null);
  useInfoTips(root);

  const on = !!file;
  // the project this clip belongs to: only the opened one (?id=) while its own clip is shown; a new clip has none yet
  const project = on && opened && file.name === opened.name ? opened : null;
  const set = useCallback(<K extends keyof Settings>(k: K, v: Settings[K]) => setSettings(s => ({ ...s, [k]: v })), []);

  const onFiles = (list: FileList | null | undefined) => {
    const f = list?.[0];
    if (!f) return;
    // `accept` only guards the picker; a dropped file is checked here too
    if (!VIDEO.test(f.name) && !f.type.startsWith('video/')) { toast('That file is not a video. Use an MP4, MOV or AVI clip.'); return; }
    setFile({ name: f.name.slice(0, 200), size: f.size }); // only the name (and size for the card) is kept; the file is never read
  };
  const remove = useCallback(() => { setFile(null); requestAnimationFrame(() => chooseBtn.current?.focus({ preventScroll: true })); }, []);
  const detect = useCallback(() => {
    if (!file) return;
    // the project is made here, once (I6): the opened project keeps its own clip, any other clip is a new project
    if (opened && opened.name === file.name) {
      dispatch({ type: 'open', id: opened.id });
      if (opened.step < 2) dispatch({ type: 'setStep', step: 2 });
    } else {
      dispatch({ type: 'upload', name: file.name });
      dispatch({ type: 'setStep', step: 2 });
    }
    flow.autoDetect = true;
    go('detect');
  }, [file, opened, dispatch]);

  return (
    <>
      <TopBar kind="step" step={1} reached={on ? reachedFor(project, 1) : 1} />
      <main ref={root} className="sp sp-upload" data-state={on ? 'file' : 'empty'}>
        {on && <h1 className="sr">Upload: clip settings</h1>}
        <section className="sp-stage" aria-label="Clip">
          <div className="slot" data-tour="tut_clip_slot">
            <div className={'drop' + (over ? ' over' : '')} id="drop" data-tour="tut_sample_clip"
              onClick={e => { if (!(e.target as Element).closest('#sampleBtn')) fileIn.current?.click(); }}
              onDragEnter={e => { e.preventDefault(); setOver(true); }} onDragOver={e => { e.preventDefault(); setOver(true); }}
              onDragLeave={e => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
              onDrop={e => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}>
              <div className="drop-in">
                <div className="drop-ico" aria-hidden="true">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4" /><path d="M12 15V9m-2.5 2.5L12 9l2.5 2.5" /></svg>
                </div>
                <h1>Drop a black-and-white clip here</h1>
                <span className="or">or</span>
                <button ref={chooseBtn} className="btn btn-line btn-lg" type="button" aria-describedby="dropHelp" tabIndex={on ? -1 : 0}
                  onClick={e => { e.stopPropagation(); fileIn.current?.click(); }}>Choose a file</button>
                <div className="fmt" id="dropHelp"><span className="sr">Accepted formats:</span><span>MP4</span><span>MOV</span><span>AVI</span></div>
                <p className="small">No clip to hand? <button className="lnk" type="button" id="sampleBtn" data-tour="tut_sample_btn" tabIndex={on ? -1 : 0}
                  onClick={e => { e.stopPropagation(); setFile({ name: SAMPLE_CLIP, size: null }); }}>Use the sample clip</button></p>
              </div>
              <input ref={fileIn} type="file" accept=".mp4,.mov,.avi,video/mp4,video/quicktime,video/x-msvideo" hidden
                onChange={e => { onFiles(e.target.files); e.target.value = ''; }} />
            </div>
            <div className="viewer uviewer" aria-label="Clip preview" role="group" aria-hidden={!on}>
              <div className="uframe">
                <Scene variant="gray" videoSrc={project?.videoSrc} />
                <div className="vtag"><span className="chip" id="vtc" ref={tag}>Frame 1</span></div>
              </div>
            </div>
          </div>
          <Timeline key={on ? 'file' : 'empty'} on={on} tag={tag} />
        </section>

        <Panel on={on} file={file} settings={settings} set={set} onRemove={remove} onDetect={detect} />
      </main>
    </>
  );
}

/* ---------- filmstrip: play, scrub (pointer + arrows) ---------- */
function Timeline({ on, tag: tagRef }: { on: boolean; tag: RefObject<HTMLSpanElement | null> }) {
  const strip = useRef<HTMLDivElement>(null);
  const ph = useRef<HTMLDivElement>(null);
  const tc = useRef<HTMLSpanElement>(null);
  const head = useRef(0);
  const raf = useRef(0);
  const [playing, setPlaying] = useState(false);

  // the playhead is written straight to the DOM (no React render per frame / pointer move)
  const paint = useCallback(() => {
    const t = head.current;
    if (ph.current) ph.current.style.transform = `translateX(${(t / DUR) * (strip.current?.clientWidth ?? 0)}px)`;
    if (tc.current) tc.current.textContent = fmt(t) + ' / ' + fmt(DUR);
    const tag = tagRef.current;
    if (tag) tag.textContent = 'Frame ' + n(Math.min(FRAMES, Math.floor(t * FPS) + 1));
    strip.current?.setAttribute('aria-valuenow', String(Math.round(t)));
    strip.current?.setAttribute('aria-valuetext', fmt(t));
  }, [tagRef]);
  const stop = useCallback(() => { cancelAnimationFrame(raf.current); setPlaying(false); }, []);
  useEffect(() => {
    if (!on) return; // the parent remounts the timeline (key) when the clip changes
    head.current = 0; paint();
    const ro = new ResizeObserver(paint);
    if (strip.current) ro.observe(strip.current);
    return () => ro.disconnect();
  }, [on, paint]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const play = () => {
    if (playing) { stop(); return; }
    setPlaying(true);
    if (head.current >= DUR - 0.1) head.current = 0;
    let last = performance.now();
    const tick = (now: number) => {
      head.current += (now - last) / 1000; last = now;
      if (head.current >= DUR) { head.current = DUR; paint(); stop(); return; }
      paint(); raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const scrubTo = (x: number) => {
    const r = strip.current!.getBoundingClientRect();
    head.current = Math.min(DUR, Math.max(0, ((x - r.left) / r.width) * DUR)); paint();
  };
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!on) return;
    stop(); e.currentTarget.setPointerCapture(e.pointerId); scrubTo(e.clientX);
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubTo(e.clientX); };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!d || !on || e.target !== e.currentTarget) return;
    e.preventDefault(); stop(); head.current = Math.min(DUR, Math.max(0, head.current + d)); paint();
  };

  return (
    <div className="timeline">
      <div className="tl-head">
        <button className="iconbtn" type="button" aria-label={playing ? 'Pause' : 'Play'} disabled={!on} onClick={play}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{playing ? <path d="M6 4h4v16H6zM14 4h4v16h-4z" /> : <path d="M7 4.5v15l13-7.5z" />}</svg>
        </button>
        <span className="tc" ref={tc}>0:00 / 0:00</span>
      </div>
      {on ? (
        <div ref={strip} className="ustrip" role="slider" tabIndex={0} aria-label="Playhead" aria-valuemin={0} aria-valuemax={DUR}
          onPointerDown={onDown} onPointerMove={onMove} onKeyDown={onKey}>
          <StripFrames n={12} />
          <div className="playhead" ref={ph} />
        </div>
      ) : (
        <div className="ustrip empty"><span>Frames show here after you add a clip</span></div>
      )}
    </div>
  );
}

/* ---------- settings panel (memoised; its callbacks are stable, and the playhead never re-renders it) ---------- */
const Range = ({ id, min, max, step, value, onChange, help, text }: { id: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; help: string; text: string }) => (
  <input type="range" id={id} min={min} max={max} step={step} value={value} aria-describedby={help} aria-valuetext={text}
    style={{ '--v': ((value - min) / (max - min)) * 100 + '%' } as CSSProperties} onChange={e => onChange(+e.target.value)} />
);

const Panel = memo(function Panel({ on, file, settings: s, set, onRemove, onDetect }: {
  on: boolean; file: { name: string; size: number | null } | null; settings: Settings;
  set: <K extends keyof Settings>(k: K, v: Settings[K]) => void; onRemove: () => void; onDetect: () => void;
}) {
  const frames = (v: number) => (v === 1 ? '1 frame' : v + ' frames');
  return (
    <aside className="sp-panel card" aria-label="Clip settings">
      <div className="p-body">
        <div className="swap">
          <div className="emptybox is-empty">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>
            <span>Add a clip to see its details and change these settings.</span>
          </div>
          <div className="filecard is-file" aria-hidden={!on}>
            <div className="fth"><Scene variant="gray" /></div>
            <div style={{ minWidth: 0 }}>
              <div className="nm" title={file?.name}>{file?.name ?? ' '}</div>
              <div className="meta"><span>{clipTime(CLIP.seconds)}</span><span>{CLIP_SIZE}</span><span>{CLIP.fps} fps</span><span>{n(CLIP.frames)} frames</span><span>{file?.size != null ? (file.size / 1048576).toFixed(1) + ' MB' : CLIP.mb + ' MB'}</span></div>
            </div>
            <button className="iconbtn" type="button" aria-label="Remove clip" tabIndex={on ? 0 : -1} onClick={onRemove}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        </div>

        <fieldset className="group" id="g1" disabled={!on} data-tour="tut_scene">
          <legend>Scene and resolution</legend>
          <div className="field">
            <span className="lblgrp"><label className="ulbl" htmlFor="scene">Scene environment</label><InfoButton help="sceneH" label="Scene environment" /></span>
            <p className="help" id="sceneH" hidden>The kind of place your clip shows.</p>
            <select className="usel" id="scene" aria-describedby="sceneH" value={s.scene} onChange={e => set('scene', e.target.value)}>
              {SCENES.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="tog" data-tour="tut_resolution">
            <div className="txt"><span className="lblgrp"><span className="ulbl" id="resL">Processing resolution</span><InfoButton help="resH" label="Processing resolution" /></span><p className="help" id="resH" hidden>480p is faster, 720p is sharper.</p></div>
            <div className="seg seg-sm" role="radiogroup" aria-labelledby="resL" aria-describedby="resH">
              {(['720', '480'] as const).map(v => (
                <label key={v}><input type="radio" name="res" value={v} checked={s.res === v} onChange={() => set('res', v)} /><span>{v}p</span></label>
              ))}
            </div>
          </div>
          <div className="tog">
            <div className="txt"><span className="lblgrp"><label className="ulbl" htmlFor="bw">Video is black and white</label><InfoButton help="bwH" label="Video is black and white" /></span><p className="help" id="bwH" hidden>Turn off if the clip already has some colour.</p></div>
            <span className="sw-tog"><input type="checkbox" role="switch" id="bw" checked={s.bw} aria-describedby="bwH" onChange={e => set('bw', e.target.checked)} /><span /></span>
          </div>
        </fieldset>

        <fieldset className="group" id="g2" disabled={!on}>
          <legend>Tracking and frames</legend>
          <div className="field" data-tour="tut_keyframe">
            <div className="lblrow"><span className="lblgrp"><label className="ulbl" htmlFor="stride">Tracking frequency</label><InfoButton help="strideH" label="Tracking frequency" /></span><span className="val">Every {s.stride} frames</span></div>
            <p className="help" id="strideH" hidden>Lower is more accurate but slower.</p>
            <Range id="stride" min={4} max={24} step={1} value={s.stride} onChange={v => set('stride', v)} help="strideH" text={'Every ' + s.stride + ' frames'} />
          </div>
          <div className="field" data-tour="tut_frames_colorize">
            <div className="lblrow"><span className="lblgrp"><label className="ulbl" htmlFor="nfr">Frames to colorize</label><InfoButton help="nfrH" label="Frames to colorize" /></span><span className="val">{frames(s.nfr)}</span></div>
            <p className="help" id="nfrH" hidden>More frames give a fuller result but take longer.</p>
            <Range id="nfr" min={1} max={150} step={1} value={s.nfr} onChange={v => set('nfr', v)} help="nfrH" text={frames(s.nfr)} />
          </div>
        </fieldset>

        <fieldset id="g3" disabled={!on} data-tour="tut_advanced">
          <details className="adv">
            <summary><span className="t">Advanced</span><span className="sub">Processing limits</span>
              <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <div className="adv-in">
              <div className="tog">
                <div className="txt"><span className="lblgrp"><label className="ulbl" htmlFor="batch">Use recommended batch size</label><InfoButton help="batchH" label="Use recommended batch size" /></span><p className="help" id="batchH" hidden>Turn off only if MoodPlay runs out of memory.</p></div>
                <span className="sw-tog"><input type="checkbox" role="switch" id="batch" checked={s.batch} aria-describedby="batchH" aria-controls="batchF" onChange={e => set('batch', e.target.checked)} /><span /></span>
              </div>
              <div className="field sub-field" id="batchF" hidden={s.batch}>
                <div className="lblrow"><span className="lblgrp"><label className="ulbl" htmlFor="chunk">Frames processed at once</label><InfoButton help="chunkH" label="Frames processed at once" /></span><span className="val">{s.chunk} frames</span></div>
                <p className="help" id="chunkH" hidden>Fewer frames use less memory but take longer.</p>
                <Range id="chunk" min={4} max={64} step={2} value={s.chunk} onChange={v => set('chunk', v)} help="chunkH" text={s.chunk + ' frames'} />
              </div>
              <div className="tog">
                <div className="txt"><span className="lblgrp"><label className="ulbl" htmlFor="full">Process full video</label><InfoButton help="fullH" label="Process full video" /></span><p className="help" id="fullH" hidden>Turn off to stop after a set number of frames.</p></div>
                <span className="sw-tog"><input type="checkbox" role="switch" id="full" checked={s.full} aria-describedby="fullH" aria-controls="fullF" onChange={e => set('full', e.target.checked)} /><span /></span>
              </div>
              <div className="field sub-field" id="fullF" hidden={s.full}>
                <div className="lblrow"><span className="lblgrp"><label className="ulbl" htmlFor="maxf">Max frames to process</label><InfoButton help="maxfH" label="Max frames to process" /></span><span className="val">{s.maxf} frames</span></div>
                <p className="help" id="maxfH" hidden>Frames after this point are left out.</p>
                <Range id="maxf" min={MAXF.min} max={MAXF.max} step={MAXF.step} value={s.maxf} onChange={v => set('maxf', v)} help="maxfH" text={s.maxf + ' frames'} />
              </div>
            </div>
          </details>
        </fieldset>
      </div>

      <div className="p-foot">
        <button className="btn btn-pink btn-lg" type="button" id="goBtn" disabled={!on} onClick={onDetect} data-tour="proceed_btn">Detect objects</button>
        <p className="next">{on ? 'Next: MoodPlay finds the objects in your clip' : 'Add a clip to continue'}</p>
      </div>
    </aside>
  );
});
