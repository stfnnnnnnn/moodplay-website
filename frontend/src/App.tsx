import { Suspense, lazy, useCallback, useState } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import Landing from './landing/Landing';
import TermsModal from './landing/TermsModal';

// The web demo is its own chunk, loaded only on /demo, so the landing bundle doesn't grow.
const DemoApp = lazy(() => import('./demo/DemoApp'));

export default function MoodPlayLanding() {
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const [tosMode, setTosMode] = useState<'signin' | 'read' | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  // Download / sign-in buttons open the Terms first (read to the end, accept, then Google sign-in).
  const initiateAuthFlow = useCallback(() => setTosMode('signin'), []);
  const closeTerms = useCallback(() => setTosMode(null), []);

  // Authentication: unchanged from the original site.
  const handleGoogleSignIn = async () => {
    setTosMode(null); // Close modal before launching popup
    setIsAuthenticating(true);
    try {
      // 1. Google Login Popup
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // 2. Hashing UID. Note: this salt ships in the public JS bundle, so it is NOT a secret. The hash is a
      //    stable pseudonym (anyone who knows a UID can recompute it), not anonymisation. Keep the value as is:
      //    changing it changes every stored ID. Protection must come from Firestore rules (see IMPLEMENTATION-NOTES).
      const encoder = new TextEncoder();
      const data = encoder.encode(user.uid + "moodplay_secret_salt_2026");
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashedId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // 3. Store hashed ID and timestamp in Firestore
      await addDoc(collection(db, "downloads"), {
        hashed_user_id: hashedId,
        platform_downloaded: "pending",
        authenticated_at: serverTimestamp()
      });

      // 4. Update UI state to show the download button
      setIsSignedIn(true);
    } catch (error) {
      console.error("Authentication or Database error:", error);
      alert("Failed to sign in. Please try again or check your popup blocker.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  // "Try the demo" target: the v5 app replica on fake data (src/demo).
  if (window.location.pathname.replace(/\/+$/, '') === '/demo') {
    return (
      <Suspense fallback={<div className="v5-fallback" style={{ minHeight: '100vh', background: '#F6F7FB' }} />}>
        <DemoApp />
      </Suspense>
    );
  }

  return (
    <>
      <Landing
        isSignedIn={isSignedIn}
        isAuthenticating={isAuthenticating}
        onSignIn={initiateAuthFlow}
        onShowTerms={() => setTosMode('read')}
      />
      {tosMode && <TermsModal mode={tosMode} onClose={closeTerms} onAccept={handleGoogleSignIn} />}
    </>
  );
}
