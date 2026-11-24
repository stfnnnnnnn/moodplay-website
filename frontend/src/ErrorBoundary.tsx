import { Component, type ErrorInfo, type ReactNode } from 'react';

/* Last-resort guard for the whole site (security report M1): if anything throws while rendering, show a plain
   message with a reload link instead of a blank page. Deliberately unstyled beyond inline basics, so it works
   even when the page's CSS is what failed. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown, info: ErrorInfo) { console.error('MoodPlay: render error', error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#F6F7FB', color: '#0E1B33', font: '400 16px/1.5 "DM Sans", system-ui, sans-serif', textAlign: 'center' }}>
        <div>
          <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 18 }}>Something went wrong on this page.</p>
          <p style={{ margin: 0 }}><a href={window.location.pathname} style={{ color: '#2350B8', fontWeight: 700 }}>Reload the page</a></p>
        </div>
      </div>
    );
  }
}
