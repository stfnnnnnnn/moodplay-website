import { useEffect, useRef, useState, type CSSProperties } from 'react';
import synaptechx from '../assets/landing/synaptechx-wordmark.png';
import Features from './Features';
import Steps from './Steps';
import { DownloadCta } from './parts';
import { useReveal } from './useReveal';
import './landing.css';

interface Props {
  isSignedIn: boolean;
  isAuthenticating: boolean;
  onSignIn: () => void;
  onShowTerms: () => void;
}

const REQUIREMENTS: [string, string, string, string?][] = [
  ['Operating system', 'Windows 10/11', 'Windows 10/11'],
  ['Processor', '6 cores / 12 threads', '8–16 cores', 'with an NVIDIA GPU'],
  ['RAM', '16 GB', '32 GB'],
  ['Graphics memory', '8 GB VRAM', '16 GB VRAM'],
  ['Storage', '80 GB free on an SSD', '100 GB free on an SSD'],
];

/** Soft colour field. Drawn as a radial gradient, not a blurred disc: no filter to paint. */
const bloom = (color: string, rest: CSSProperties): CSSProperties => ({
  ...rest, background: `radial-gradient(closest-side, ${color} 35%, ${color}00 100%)`,
});

/** Landing page, built from docs/design/landing-mockups/landing-a12.html. */
export default function Landing({ isSignedIn, isAuthenticating, onSignIn, onShowTerms }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const [readyRef] = useReveal<HTMLElement>(0.15);

  // Phone menu: closes on Escape (focus back to the button) or a tap outside.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      navRef.current?.querySelector<HTMLButtonElement>('.menu-btn')?.focus();
    };
    const onDown = (e: PointerEvent) => { if (!navRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [menuOpen]);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="mp">
      <a className="skip" href="#main">Skip to content</a>
      <div className="blooms" aria-hidden="true">
        <i style={bloom('#FFC9DC', { width: 820, height: 820, left: -270, top: -210 })} />
        <i style={bloom('#C9DCFA', { width: 880, height: 880, right: -310, top: 30 })} />
        <i style={bloom('#FFE1EC', { width: 520, height: 520, left: '34%', top: 350, opacity: 0.7 })} />
      </div>

      <div className="wrap navwrap">
        <nav aria-label="Main" ref={navRef}>
          <a href="#" className="logo" aria-label="MoodPlay home"><span className="m">Mood</span><span className="p">Play</span></a>
          <button type="button" className="menu-btn" aria-expanded={menuOpen} aria-controls="nav-links" onClick={() => setMenuOpen((o) => !o)}>
            <span className="bars" aria-hidden="true"><i /><i /></span>
            Menu
          </button>
          <div className="links" id="nav-links" data-open={menuOpen || undefined} onClick={(e) => { if ((e.target as HTMLElement).closest('a,button')) closeMenu(); }}>
            <a className="l" href="#features">Features</a>
            <a className="l" href="#steps">How it works</a>
            <a className="l" href="#requirements">Requirements</a>
            <DownloadCta isSignedIn={isSignedIn} isAuthenticating={isAuthenticating} onSignIn={onSignIn} signedOutLabel="Download for Windows" className="btn btn-pink btn-sm" />
          </div>
        </nav>

      </div>
      <main id="main" tabIndex={-1}>
      <div className="wrap">
        <header className="hero">
          <h1><span className="p">Colorize videos.</span><span className="b">Give cinematic moods.</span></h1>
          <p>Pick a color for each person and thing in your video, and MoodPlay keeps it locked to them from the first frame to the last. Then give the whole scene a mood, from neon nights to warm sunsets.</p>
          <div className="ctas">
            <a className="btn btn-pink" href="/demo">Try the demo</a>
          </div>
          <div className="fine">Free for Windows 10/11 with an NVIDIA graphics card. <a href="#requirements">Check your PC</a>. No install needed for the demo.</div>
        </header>
      </div>

      <svg className="wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60C240 10 480 10 720 45s480 50 720 0V90H0z" fill="#EEF3FD" /></svg>
      <Features />
      <svg className="wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30C240 80 480 80 720 45S1200-5 1440 40V0H0z" fill="#EEF3FD" /></svg>

      <div className="wrap">
        <Steps />

        <section className="req-sec" id="requirements" aria-labelledby="rh" data-rv ref={readyRef}>
          <div className="req-card rv rv-lift">
            <div className="intro">
              <h2 id="rh"><span className="p">Ready</span> <span className="b">to create?</span></h2>
              <p>MoodPlay runs on your own computer, so check your PC first. Then sign in with Google to get the installer.</p>
              <DownloadCta isSignedIn={isSignedIn} isAuthenticating={isAuthenticating} onSignIn={onSignIn} signedOutLabel="Sign in to download" />
            </div>
            <div className="scroll">
              <table>
                <thead><tr><th scope="col">Hardware</th><th scope="col" className="min">Minimum</th><th scope="col" className="rec">Recommended</th></tr></thead>
                <tbody>
                  {REQUIREMENTS.map(([hw, min, rec, note]) => (
                    <tr key={hw}>
                      <td>{hw}</td>
                      <td>{min}{note && <small>{note}</small>}</td>
                      <td>{rec}{note && <small>{note}</small>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <footer className="cfoot rv rv-fade" style={{ '--d': '220ms' } as CSSProperties}>
            <span className="logo-sx"><img src={synaptechx} alt="Made by SynapTechX" width={800} height={150} loading="lazy" /></span>
            <button type="button" className="linkbtn" onClick={onShowTerms}>Terms and privacy</button>
          </footer>
        </section>
      </div>
      </main>
    </div>
  );
}
