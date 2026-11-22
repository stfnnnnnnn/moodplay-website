import { useEffect, useRef, useState, type UIEvent } from 'react';

interface Props {
  /** 'signin': read to the end, tick, then sign in. 'read': view only (footer link). */
  mode: 'signin' | 'read';
  onClose: () => void;
  onAccept: () => void;
}

const G_ICON = (
  <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

/** Terms & Privacy. Content and the scroll-to-accept gate are unchanged from the original site. */
export default function TermsModal({ mode, onClose, onAccept }: Props) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus moves into the dialog, Tab stays inside it, Escape closes, focus returns to the opener.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    bodyRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),[tabindex="0"]'));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); opener?.focus?.(); };
  }, [onClose]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 5) setHasScrolledToBottom(true);
  };

  return (
    <div className="fixed inset-0 bg-[#0E1B33]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="tos-title">
      <div ref={dialogRef} className="bg-white border border-gray-100 rounded-3xl p-8 md:p-10 max-w-3xl w-full relative text-left shadow-2xl flex flex-col max-h-[90vh]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h2 id="tos-title" className="text-3xl font-extrabold text-[#0E1B33] mb-6 shrink-0">Terms &amp; Privacy</h2>

        <div
          ref={bodyRef}
          tabIndex={0}
          onScroll={handleScroll}
          className="text-base text-gray-600 space-y-5 overflow-y-auto overscroll-contain pr-4 font-medium flex-grow border-b border-gray-100 pb-6 mb-6"
        >
          {mode === 'signin' && (
            <p className="text-gray-500 italic mb-4">Please scroll to the bottom to accept the terms and proceed with authentication.</p>
          )}
          <p><strong className="text-[#0E1B33] text-lg">1. Purpose of Authentication</strong></p>
          <p>
            MoodPlay requires users to sign in via Google exclusively for the purpose of maintaining accurate download analytics and preventing automated abuse of our distribution endpoints.
          </p>
          <p><strong className="text-[#0E1B33] text-lg">2. Data Usage &amp; Storage</strong></p>
          <p>We do not harvest, sell, or deeply analyze your personal data. The only information recorded in our database is:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-500">
            <li>Your Google Account ID (anonymized/hashed)</li>
            <li>Timestamp of login/download</li>
          </ul>
          <p>
            We do <strong className="text-[#0E1B33]">not</strong> have access to your passwords, your Google Drive files, or your contacts.
          </p>
          <p><strong className="text-[#0E1B33] text-lg">3. App Usage</strong></p>
          <p>
            All video processing done within the MoodPlay application runs entirely on your local machine. No videos or images are sent to our servers for processing. By downloading this software, you agree to run it on compatible hardware as listed in the system requirements.
          </p>
          <p><strong className="text-[#0E1B33] text-lg">4. Distribution</strong></p>
          <p>
            The executable files provided are for personal use. You may not repackage, sell, or distribute modified versions of the MoodPlay application without explicit consent.
          </p>
        </div>

        {mode === 'signin' ? (
          <div className="shrink-0 flex flex-col gap-5">
            <div className={`transition-opacity duration-300 ${hasScrolledToBottom ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  disabled={!hasScrolledToBottom}
                  onChange={(e) => setTosAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-gray-300 accent-[#2350B8] cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                  I have scrolled, read, and understand the terms regarding data usage, local processing, and authentication requirements.
                </span>
              </label>
            </div>
            <button
              type="button"
              disabled={!tosAccepted}
              onClick={onAccept}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
                tosAccepted ? 'bg-[#C8326B] text-white hover:bg-[#9E1F50]' : 'bg-gray-100 text-gray-500 cursor-not-allowed'
              }`}
            >
              {tosAccepted ? (<>{G_ICON}Accept &amp; Sign in with Google</>) : 'Scroll to accept terms'}
            </button>
          </div>
        ) : (
          <button type="button" onClick={onClose} className="shrink-0 w-full py-4 rounded-xl font-bold text-lg bg-[#2350B8] text-white hover:bg-[#1A3D8F] transition-colors">
            Close
          </button>
        )}
      </div>
    </div>
  );
}
