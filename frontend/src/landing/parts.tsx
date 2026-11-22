import { INSTALLER_PATH, gradeStyle, type Mood, type MoodKey } from './data';

const GRADED: MoodKey[] = ['tokyo', 'sunny', 'blues'];

/** One layer per mood, crossfaded by opacity (gradients themselves can't be transitioned). */
export function Grades({ mood }: { mood: MoodKey }) {
  return (
    <>
      {GRADED.map((k) => (
        <div key={k} className="grade" style={{ ...gradeStyle(k), opacity: mood === k ? 1 : 0 }} />
      ))}
    </>
  );
}

export function Knob() {
  return (
    <span className="cmp-knob">
      <b className="l" />
      <b className="r" />
    </span>
  );
}

export function Swatch({ mood }: { mood: Mood }) {
  return (
    <span className="sw" aria-hidden="true">
      {mood.swatch.map((c) => (
        <i key={c} style={{ background: c }} />
      ))}
    </span>
  );
}

export function UploadIcon({ size = 30, stroke = 2 }: { size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
    </svg>
  );
}

interface DownloadCtaProps {
  isSignedIn: boolean;
  isAuthenticating: boolean;
  onSignIn: () => void;
  signedOutLabel: string;
  className?: string;
}

/** Signed out: starts Terms -> Google sign-in. Signed in: downloads the installer. Only one is ever rendered. */
export function DownloadCta({ isSignedIn, isAuthenticating, onSignIn, signedOutLabel, className = 'btn btn-pink' }: DownloadCtaProps) {
  if (isSignedIn) {
    return (
      <a className={className} href={INSTALLER_PATH} download="MoodPlayInstaller.exe">
        Download for Windows
      </a>
    );
  }
  return (
    <button className={className} type="button" onClick={onSignIn} disabled={isAuthenticating}>
      {isAuthenticating ? 'Connecting…' : signedOutLabel}
    </button>
  );
}
