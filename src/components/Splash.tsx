// Markowy ekran startowy z animacją (krótki, znika sam).
import { useEffect, useState } from 'react';

export function Splash() {
  const [gone, setGone] = useState(false);
  const [fade, setFade] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setFade(true), 1100);
    const t2 = setTimeout(() => setGone(true), 1700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  if (gone) return null;
  return (
    <div className={`splash ${fade ? 'fade' : ''}`}>
      <div className="splash-core">
        <svg viewBox="0 0 120 120" className="splash-logo" aria-hidden>
          <defs>
            <radialGradient id="sg" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="var(--neon)" stopOpacity="0.9" />
              <stop offset="100%" stopColor="var(--neon)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="54" fill="url(#sg)" className="splash-pulse" />
          <circle cx="60" cy="60" r="40" fill="none" stroke="var(--neon)" strokeWidth="2" opacity="0.5" />
          {/* strzałka nawigacji */}
          <path
            d="M60 26 L82 88 L60 74 L38 88 Z"
            fill="var(--neon)"
            stroke="#03121a"
            strokeWidth="2"
            className="splash-arrow"
          />
        </svg>
        <div className="splash-title">JAJEK&nbsp;NAVI</div>
        <div className="splash-sub">nawigacja terenowa</div>
      </div>
    </div>
  );
}
