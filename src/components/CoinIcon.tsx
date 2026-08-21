/** A symmetrical gold coin used as the Treasure Chess mark. */
export function CoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Gold coin">
      <defs>
        <linearGradient id="coin-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe9a3" />
          <stop offset="55%" stopColor="#f2c14b" />
          <stop offset="100%" stopColor="#c98f1d" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#coin-face)" stroke="#8a5d0d" strokeWidth="2" />
      <circle
        cx="24"
        cy="24"
        r="16.5"
        fill="none"
        stroke="#8a5d0d"
        strokeWidth="1.6"
        opacity="0.75"
      />
      {/* symmetrical four-point star emblem */}
      <path
        d="M24 10 L27.6 20.4 L38 24 L27.6 27.6 L24 38 L20.4 27.6 L10 24 L20.4 20.4 Z"
        fill="#8a5d0d"
        opacity="0.85"
      />
    </svg>
  );
}

/** A compact mixed pile for the rule that introduces all hidden treasure. */
export function CoinPileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Pile of coins">
      <circle cx="17" cy="29" r="10" fill="#e8edf2" stroke="#77818c" strokeWidth="2" />
      <circle cx="31" cy="29" r="10" fill="#f2c14b" stroke="#8a5d0d" strokeWidth="2" />
      <circle cx="24" cy="18" r="10" fill="#ffe08a" stroke="#8a5d0d" strokeWidth="2" />
      <path d="M19 18h10M24 13v10" stroke="#8a5d0d" strokeWidth="2" opacity=".75" />
    </svg>
  );
}
