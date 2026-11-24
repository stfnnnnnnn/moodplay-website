import { hasScreenParam, screenFromUrl, tourFromUrl, type Screen } from '../nav';

/* The 26 tour steps (docs/design/tutorial-v5.md, with the Projects B edits: 24 = the Projects grid,
   25 = the project page's renders). Targets are data-tour attributes, never class names.
   sel: "a, b" = the union of every match (one spotlight round all of them); "a | b" = the first alternative
   that is visible. kind:
     look  the target is lit but not clickable;
     try   the target is usable but does not advance the tour;
     act   doing `act` in the spotlight advances (Next does it for you: doSel, else act);
     nav   like act, but the page itself navigates (its own handler runs), and the tour follows to the next page;
     go    like act, but the tour intercepts the click and navigates itself (Detect objects would otherwise
           create a new project: the tour runs on the sample, so none of your projects change). */

export type PageKey = 'home' | 'upload' | 'detect' | 'colorize' | 'mood' | 'render' | 'results' | 'projects';
export type Kind = 'look' | 'try' | 'act' | 'nav' | 'go';
export interface TourStep {
  page: PageKey;
  /** Screens the step shows on; the first is where the tour opens it. */
  screens: Screen[];
  sel: string | null;
  kind: Kind;
  act?: string;
  doSel?: string;
  /** Milliseconds between the act and the next step (the page's own feedback shows first). */
  wait?: number;
  /** Acting re-shows this step instead of advancing (the Home empty state). */
  stay?: boolean;
  /** The target can be taller than the window: its top part is lit and the card sits below it. */
  partial?: boolean;
  place: string;
  t: string;
  b: string;
  doIt?: string;
  /** Upload settings steps: add the sample clip first so the settings are on. */
  needsClip?: boolean;
  end?: boolean;
  /** Variant used while `when` is visible (Home with no projects yet). */
  empty?: Partial<TourStep> & { when: string };
}

export const NAMES: Record<PageKey, string> = {
  home: 'Home', upload: 'Upload', detect: 'Detect', colorize: 'Colorize', mood: 'Mood', render: 'Render', results: 'Results', projects: 'Projects',
};

const T = (id: string) => `[data-tour="${id}"]`;

export const STEPS: TourStep[] = [
  { page: 'home', screens: ['home'], sel: T('tut_resume'), kind: 'look', place: 'left bottom',
    t: 'Pick up where you stopped', b: 'Home opens on your last project, frozen where you left it. Continue colorizing takes you straight back to that step.',
    empty: { when: T('tut_first_run'), sel: T('tut_first_run'), kind: 'act', act: T('tut_make_sample'), stay: true, wait: 900, place: 'right bottom left',
      t: 'Let’s make a sample project', b: 'We’ll make a sample project so you can try every step on it. It uses a bundled clip with the objects already found, and your own videos aren’t touched.',
      doIt: 'Click Create sample project' } },
  { page: 'home', screens: ['home'], sel: T('tut_nav_projects'), kind: 'look', place: 'bottom',
    t: 'Every project in one place', b: 'Projects keeps all your videos, finished or in progress, with every render. The tour ends there.' },
  { page: 'home', screens: ['home'], sel: T('landing_btn'), kind: 'nav', act: T('landing_btn'), place: 'bottom left',
    t: 'Start a new video', b: 'Click Upload video. The tour uses a sample clip, so none of your projects change.', doIt: 'Click Upload video' },

  { page: 'upload', screens: ['upload'], sel: T('tut_sample_clip') + ' | ' + T('tut_clip_slot'), kind: 'act', act: T('tut_sample_btn'), place: 'right',
    t: 'Add a clip', b: 'Drop a black-and-white clip here, or use the sample clip to follow along.', doIt: 'Click Use the sample clip' },
  { page: 'upload', screens: ['upload'], sel: T('tut_scene'), kind: 'look', needsClip: true, place: 'left',
    t: 'Tell MoodPlay about the clip', b: 'Pick the kind of place it shows. 720p is sharper, 480p is faster. Leave Black and white on unless the clip already has some colour. The info button beside each setting explains it.' },
  { page: 'upload', screens: ['upload'], sel: [T('tut_keyframe'), T('tut_frames_colorize'), T('tut_advanced')].join(', '), kind: 'look', needsClip: true, place: 'left',
    t: 'Choose how closely to track', b: 'Lower tracking frequency and more frames give a better result, but take longer. Leave Advanced alone unless MoodPlay runs out of memory.' },
  { page: 'upload', screens: ['upload'], sel: T('proceed_btn'), kind: 'go', act: T('proceed_btn'), needsClip: true, place: 'left top',
    t: 'Find the objects', b: 'MoodPlay finds each person and thing, then follows it through the whole clip.', doIt: 'Click Detect objects' },

  { page: 'detect', screens: ['detect'], sel: T('tut_lanes'), kind: 'act', act: T('tut_lanes') + ' [data-o="5"] ' + T('tut_gap'), place: 'top',
    t: 'One lane per object', b: 'Each bar shows where an object was found. Pink gaps are where it went missing.', doIt: 'Click the first gap in lane 5 to jump there' },
  { page: 'detect', screens: ['detect'], sel: T('tut_frame_tools'), kind: 'try', place: 'right left',
    t: 'Fix an object with + and −', b: 'Jumping to a gap turns on + Add area, so clicking Person 3 on the frame adds it back. − Remove area takes away anything that isn’t part of it.' },
  { page: 'detect', screens: ['detect'], sel: T('tut_add_by_name'), kind: 'try', place: 'left',
    t: 'Add something it missed', b: 'Type a name, like dog or lamp post, and MoodPlay looks for it in every frame. You can also click it on the frame.' },
  { page: 'detect', screens: ['detect'], sel: T('btn_to_colorize'), kind: 'nav', act: T('btn_to_colorize'), place: 'left top',
    t: 'Objects look right?', b: 'Next you give each object its colour.', doIt: 'Click Continue to colorize' },

  { page: 'colorize', screens: ['colorize'], sel: T('tut_select_object') + ' | ' + T('tut_frame'), kind: 'act', act: T('tut_select_object'), place: 'right left',
    t: 'Select an object', b: 'The pink ring shows which object you’re colouring, on the frame and in the list.', doIt: 'Click Person 3, on the right of the frame' },
  { page: 'colorize', screens: ['colorize'], sel: T('tut_color_pick'), kind: 'act', act: T('tut_color_pick') + ' .swb', doSel: T('tut_color_pick') + ' .swb[data-c="#3E9B5C"]', wait: 700, place: 'left',
    t: 'Choose its colour', b: 'Pick one of your recent colours, or open Custom color for any shade. The first swatch keeps the object black and white.', doIt: 'Click Green to try it' },
  { page: 'colorize', screens: ['colorize'], sel: T('tut_hold'), kind: 'try', place: 'bottom left',
    t: 'Hold Space to compare', b: 'Hold Space, or press and hold this button, to see the black-and-white original. Let go to see your colours again.' },
  { page: 'colorize', screens: ['colorize'], sel: T('btn_finish'), kind: 'nav', act: T('btn_finish'), place: 'left top',
    t: 'Ready for a mood', b: 'Objects you didn’t colour stay black and white.', doIt: 'Click Continue to mood' },

  { page: 'mood', screens: ['mood'], sel: T('tut_mood_board'), kind: 'try', place: 'right left',
    t: 'Four looks, one frame', b: 'Each tile is your frame in a different mood. Click one to choose it. The corner button opens it larger.' },
  { page: 'mood', screens: ['mood'], sel: T('tut_skip_mood'), kind: 'try', place: 'left top',
    t: 'No mood? That’s fine', b: 'Skip renders only the colours you picked, with no look on top.' },
  { page: 'mood', screens: ['mood'], sel: T('btn_apply_note') + ', ' + T('btn_apply'), kind: 'nav', act: T('btn_apply'), place: 'left top',
    t: 'Render when you’re ready', b: 'The estimate comes from earlier runs on this computer.', doIt: 'Click Render video' },

  { page: 'render', screens: ['render'], sel: T('tut_render_progress'), kind: 'look', place: 'left',
    t: 'Watch it render', b: 'Your object colours go on first, then the mood. Time left starts from earlier runs and corrects itself as it goes.' },
  { page: 'render', screens: ['render'], sel: T('tut_cancel_render'), kind: 'look', place: 'left top',
    t: 'Stop any time', b: 'Cancel render stops without changing your colours or mood. When it finishes, Results open by themselves.' },

  { page: 'results', screens: ['results'], sel: T('tut_compare'), kind: 'try', place: 'right left',
    t: 'Compare before and after', b: 'Both videos share one playhead. Switch between Original, Colorized and Side by side up here.' },
  { page: 'results', screens: ['results'], sel: T('results_summary'), kind: 'look', place: 'left',
    t: 'Everything you chose', b: 'Each object’s colour and the mood, in one card. Change takes you back to that step.' },
  { page: 'results', screens: ['results'], sel: T('btn_download'), kind: 'try', place: 'left top',
    t: 'Save your video', b: 'Download video saves the MP4 with your colours and mood. Object colors only leaves the mood out.' },

  { page: 'projects', screens: ['projects'], sel: T('tut_projects_grid'), kind: 'try', partial: true, place: 'right left bottom',
    t: 'Your library', b: 'Every video you start lands here, marked Finished or In progress. Select one to see its details beside the grid.' },
  { page: 'projects', screens: ['project'], sel: T('tut_project_runs'), kind: 'look', partial: true, place: 'left',
    t: 'Every render, kept', b: 'Each render keeps its mood and its video to download again. Open at step reopens the project at Upload, Detect, Colorize, Mood or Results.' },
  { page: 'projects', screens: ['project', 'projects'], sel: null, kind: 'look', place: '', end: true,
    t: 'You’re ready', b: 'That’s the whole flow: upload, detect, colorize, pick a mood, render. Now try it with a clip of your own.' },
];

export const N = STEPS.length;

/** First step (1-based) shown on a screen, or null (the first-run intro has none). */
export function firstStepOn(screen: Screen): number | null {
  const i = STEPS.findIndex(s => s.screens.includes(screen));
  return i < 0 ? null : i + 1;
}

/** Step n (1-based) if it shows on this screen, else this screen's first step, else n. */
export function stepFor(n: number, screen: Screen): number {
  return STEPS[n - 1]?.screens.includes(screen) ? n : firstStepOn(screen) ?? n;
}

/** The step a ?tour=n link opens (1-26). With an explicit ?screen= it is that screen's first step when n belongs
 *  to another page (tutorial-v5.md: "If step n belongs to another page, the tour starts at this page's first step"). */
export function deepLinkStep(search: string): number | null {
  const n = tourFromUrl(search);
  if (n == null) return null;
  return hasScreenParam(search) ? stepFor(n, screenFromUrl(search).screen) : n;
}
