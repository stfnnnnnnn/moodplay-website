import { useMemo, useState } from 'react';
import './projects.css';
import { TopBar } from '../chrome/TopBar';
import { IconQ, IconUp } from '../chrome/Icons';
import { ProjectCard, type MenuItem } from '../chrome/ProjectCard';
import { copyName, useDemo, useDemoExtra, type Project } from '../store';
import { demoHref, go, linkClick } from '../nav';
import { setPending, useDemoUi } from '../ui';
import { MOOD_LABEL, mid, plural } from '../format';

/* Projects library (v5-projects-b.html): filter (All / In progress / Finished with counts), sort, grid, empty states.
   Opening a card goes to the full project page (?screen=project&id=…). */

type Filter = 'all' | 'wip' | 'fin';

export default function Projects() {
  const { state } = useDemo();
  const { duplicate } = useDemoExtra();
  const { query, setQuery, toast } = useDemoUi();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<'opened' | 'name'>('opened');
  const projects = state.projects;
  const n = projects.length, nf = projects.filter(p => p.finished).length;
  const q = query.trim().toLowerCase();

  const list = useMemo(() => {
    const l = projects.filter(p => (filter === 'all' || (filter === 'fin') === p.finished) &&
      (!q || (p.name + ' ' + (p.mood ? MOOD_LABEL[p.mood] : '')).toLowerCase().includes(q)));
    return l.sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.updated.localeCompare(a.updated));
  }, [projects, filter, q, sort]);

  const open = (p: Project, act: 'rename' | 'delete' | null = null) => {
    setPending(p.id, act, true);
    go('project', { id: p.id });
  };
  const menu = (p: Project): MenuItem[] => [
    { key: 'rename', label: 'Rename', onSelect: () => open(p, 'rename') },
    { key: 'dup', label: 'Duplicate with another mood', onSelect: () => { duplicate(p.id); toast('Duplicated. Pick a new mood for ' + mid(copyName(p.name), 40) + '.'); } },
    { key: 'delete', label: 'Delete project', danger: true, sep: true, onSelect: () => open(p, 'delete') },
  ];
  const counts: Record<Filter, number> = { all: n, wip: n - nf, fin: nf };

  let body;
  if (!n) {
    body = (
      <div className="empty">
        <span className="ico"><IconUp /></span><h2>No projects yet</h2>
        <p>Drop a black-and-white video here to start your first project. MoodPlay saves your place at every step and keeps every render.</p>
        <a className="btn btn-line" href={demoHref('upload')} onClick={linkClick('upload')}>Choose a video file</a>
      </div>
    );
  } else if (!list.length) {
    const label = q ? `No projects match “${query.trim()}”` : filter === 'fin' ? 'No finished projects yet' : 'Nothing in progress';
    const hint = q ? 'Check the spelling, or search for a mood like Sunday Blues.' : filter === 'fin' ? 'A project counts as finished once its video is rendered.' : 'Every project is finished. Upload a video to start another.';
    body = (
      <div className="empty">
        <span className="ico"><IconQ /></span><h2>{label}</h2><p>{hint}</p>
        {q
          ? <button className="btn btn-line" type="button" onClick={() => { setQuery(''); document.querySelector<HTMLInputElement>('.v5 .tsearch input')?.focus(); }}>Clear search</button>
          : <button className="btn btn-line" type="button" onClick={() => setFilter('all')}>Show all projects</button>}
      </div>
    );
  } else {
    body = list.map(p => <ProjectCard key={p.id} p={p} onOpen={() => open(p)} menu={menu(p)} />);
  }

  return (
    <>
      <TopBar kind="home" active="projects" />
      <main className="projects">
        <section aria-labelledby="ph">
          <div className="ph">
            <h1 tabIndex={-1} id="ph">Projects</h1>
            <p>{n ? plural(n, 'project', 'projects') + '. Open one to see its renders, download them again, or reopen it at any step.' : 'Every video you upload becomes a project here, with all of its renders.'}</p>
          </div>
          {n > 0 && (
            <div className="tools">
              <div className="seg" role="group" aria-label="Show">
                {([['all', 'All'], ['wip', 'In progress'], ['fin', 'Finished']] as const).map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label} <span className="c">{counts[k]}</span></button>
                ))}
              </div>
              <label className="sort">Sort
                <select value={sort} onChange={e => setSort(e.target.value as 'opened' | 'name')}>
                  <option value="opened">Last opened</option><option value="name">Name A to Z</option>
                </select>
              </label>
            </div>
          )}
          <div className="pgrid" id="grid" data-tour="tut_projects_grid">{body}</div>
        </section>
      </main>
    </>
  );
}
