/**
 * Badges oficials d'App Store i Google Play.
 *
 * Reproduïm els assets oficials com a SVG inline:
 *  - Apple: Apple Marketing Communications Guidelines (https://developer.apple.com/app-store/marketing/guidelines/)
 *  - Google: Google Play Branding Guidelines (https://play.google.com/intl/en_us/badges/)
 *
 * Mantenim la mida i proporcions estàndard perquè qualsevol culer els reconegui.
 */

const BADGE_HEIGHT = 56;

const buttonBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 12,
  height: BADGE_HEIGHT,
  padding: '0 18px',
  background: '#000',
  color: '#fff',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.16)',
  textDecoration: 'none',
  fontFamily: 'var(--font-ui)',
  transition: 'transform .2s ease, background .2s ease',
  minWidth: 180,
};

const smallLabel: React.CSSProperties = {
  fontSize: 10,
  lineHeight: 1.1,
  opacity: 0.78,
  letterSpacing: 0.3,
  textTransform: 'none',
};

const bigLabel: React.CSSProperties = {
  fontSize: 17,
  lineHeight: 1.1,
  fontWeight: 600,
  letterSpacing: -0.1,
};

export default function StoreBadges() {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      <a
        href="https://apps.apple.com"
        target="_blank"
        rel="noopener noreferrer"
        style={buttonBase}
        aria-label="Descarrega a App Store"
      >
        {/* Apple logo (versió oficial monocrom blanca) */}
        <svg width="26" height="32" viewBox="0 0 24 28" fill="#fff" aria-hidden="true">
          <path d="M17.05 14.81c-.03-3 2.45-4.45 2.56-4.52-1.4-2.05-3.58-2.33-4.36-2.36-1.86-.19-3.62 1.09-4.56 1.09-.94 0-2.39-1.07-3.93-1.04-2.02.03-3.88 1.17-4.92 2.98-2.1 3.63-.54 9 1.51 11.95 1 1.45 2.19 3.07 3.74 3.01 1.5-.06 2.07-.97 3.89-.97 1.82 0 2.33.97 3.92.94 1.62-.03 2.65-1.47 3.64-2.92 1.14-1.67 1.62-3.3 1.65-3.39-.03-.01-3.17-1.21-3.2-4.77ZM14.43 5.5c.82-1 1.37-2.39 1.22-3.78-1.18.05-2.61.79-3.45 1.78-.76.89-1.42 2.3-1.24 3.66 1.32.1 2.66-.67 3.47-1.66Z"/>
        </svg>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={smallLabel}>Descarrega-la a</span>
          <span style={bigLabel}>App Store</span>
        </span>
      </a>

      <a
        href="https://play.google.com"
        target="_blank"
        rel="noopener noreferrer"
        style={buttonBase}
        aria-label="Disponible a Google Play"
      >
        {/* Triangle multicolor oficial Google Play */}
        <svg width="26" height="28" viewBox="0 0 28 30" aria-hidden="true">
          <defs>
            <linearGradient id="gp-a" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#00C2FF" />
              <stop offset="1" stopColor="#00A1FF" />
            </linearGradient>
            <linearGradient id="gp-b" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#FFD400" />
              <stop offset="1" stopColor="#FFA300" />
            </linearGradient>
            <linearGradient id="gp-c" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FF3A44" />
              <stop offset="1" stopColor="#C31162" />
            </linearGradient>
            <linearGradient id="gp-d" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#00F076" />
              <stop offset="1" stopColor="#00A14B" />
            </linearGradient>
          </defs>
          <path d="M2 2.3v25.4c0 .55.18 1.05.5 1.45L16.7 15 2.5.85C2.18 1.25 2 1.75 2 2.3Z" fill="url(#gp-a)"/>
          <path d="M21.4 10.1 17.7 12.2 16.7 15 4.5 27.2c.32.4.77.6 1.27.55.27-.04.55-.14.83-.3l16.8-9.55-2-7.8Z" fill="url(#gp-c)"/>
          <path d="M21.4 10.1 4.6 0.55C4.3.4 4 .3 3.73.28 3.23.23 2.78.43 2.46.85L16.7 15l4.7-4.9Z" fill="url(#gp-d)"/>
          <path d="M25.8 13.4 21.4 10.9 16.7 15.6l4.7 4.7 4.4-2.5c1.27-.72 1.27-2.68 0-3.4Z" fill="url(#gp-b)"/>
        </svg>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={smallLabel}>Disponible a</span>
          <span style={bigLabel}>Google Play</span>
        </span>
      </a>
    </div>
  );
}
