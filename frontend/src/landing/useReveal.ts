import { useEffect, useRef, useState } from 'react';

/**
 * Marks a section as revealed the first time it scrolls into view (sets `data-in` on it).
 * CSS owns the motion (see "reveal" in landing.css), so nothing runs on scroll and nothing
 * re-renders per frame. Without IntersectionObserver the section is shown at once.
 */
export function useReveal<T extends HTMLElement>(threshold = 0.18) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => { el.dataset.in = ''; setInView(true); };
    if (!('IntersectionObserver' in window)) { show(); return; }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) { show(); io.disconnect(); }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, inView] as const;
}
