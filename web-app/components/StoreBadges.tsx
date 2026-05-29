const S: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 14,
  padding: '13px 28px',
  border: '1px solid rgba(240,236,226,0.5)',
  color: 'var(--cream)',
  background: 'transparent',
  fontFamily: 'var(--font-body)',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '2.5px',
  textTransform: 'uppercase' as const,
  textDecoration: 'none',
  transition: 'background .25s, color .25s',
  cursor: 'pointer',
}

function AppleSVG() {
  return (
    <svg width="18" height="22" viewBox="0 0 24 28" fill="currentColor" aria-hidden="true">
      <path d="M17.05 14.81c-.03-3 2.45-4.45 2.56-4.52-1.4-2.05-3.58-2.33-4.36-2.36-1.86-.19-3.62 1.09-4.56 1.09-.94 0-2.39-1.07-3.93-1.04-2.02.03-3.88 1.17-4.92 2.98-2.1 3.63-.54 9 1.51 11.95 1 1.45 2.19 3.07 3.74 3.01 1.5-.06 2.07-.97 3.89-.97 1.82 0 2.33.97 3.92.94 1.62-.03 2.65-1.47 3.64-2.92 1.14-1.67 1.62-3.3 1.65-3.39-.03-.01-3.17-1.21-3.2-4.77ZM14.43 5.5c.82-1 1.37-2.39 1.22-3.78-1.18.05-2.61.79-3.45 1.78-.76.89-1.42 2.3-1.24 3.66 1.32.1 2.66-.67 3.47-1.66Z"/>
    </svg>
  )
}

function PlaySVG() {
  return (
    <svg width="18" height="20" viewBox="0 0 22 24" aria-hidden="true">
      <defs>
        <linearGradient id="pg-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#00C2FF"/><stop offset="1" stopColor="#00A1FF"/>
        </linearGradient>
        <linearGradient id="pg-b" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFD400"/><stop offset="1" stopColor="#FFA300"/>
        </linearGradient>
        <linearGradient id="pg-c" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF3A44"/><stop offset="1" stopColor="#C31162"/>
        </linearGradient>
        <linearGradient id="pg-d" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#00F076"/><stop offset="1" stopColor="#00A14B"/>
        </linearGradient>
      </defs>
      <path d="M1.5 1.8v20.4c0 .44.14.84.4 1.16L13.36 12 1.9.64A1.4 1.4 0 0 0 1.5 1.8Z" fill="url(#pg-a)"/>
      <path d="M17.1 8.1 14.1 9.8 13.36 12l-9.8 9.8c.26.32.62.48 1.02.44.22-.03.44-.11.66-.24l13.44-7.64L17.1 8.1Z" fill="url(#pg-c)"/>
      <path d="M17.1 8.1 3.66.44C3.44.32 3.2.24 2.98.22 2.58.18 2.22.34 1.96.64L13.36 12 17.1 8.1Z" fill="url(#pg-d)"/>
      <path d="M20.68 10.72l-3.58-2.62L13.36 12.5l3.72 3.76 3.6-2c1.02-.58 1.02-2.16 0-2.74Z" fill="url(#pg-b)"/>
    </svg>
  )
}

export default function StoreBadges({ center = false }: { center?: boolean }) {
  const hover = (e: React.MouseEvent<HTMLAnchorElement>) => {
    (e.currentTarget as HTMLElement).style.background = 'var(--cream)'
    ;(e.currentTarget as HTMLElement).style.color = 'var(--black)'
  }
  const out = (e: React.MouseEvent<HTMLAnchorElement>) => {
    (e.currentTarget as HTMLElement).style.background = 'transparent'
    ;(e.currentTarget as HTMLElement).style.color = 'var(--cream)'
  }

  return (
    <div style={{
      display: 'flex',
      gap: 16,
      flexWrap: 'wrap',
      justifyContent: center ? 'center' : 'flex-start',
    }}>
      <a
        href="https://apps.apple.com"
        target="_blank"
        rel="noopener noreferrer"
        style={S}
        onMouseEnter={hover}
        onMouseLeave={out}
        aria-label="Descarrega a App Store"
      >
        <AppleSVG />
        App Store
      </a>

      <a
        href="https://play.google.com"
        target="_blank"
        rel="noopener noreferrer"
        style={S}
        onMouseEnter={hover}
        onMouseLeave={out}
        aria-label="Disponible a Google Play"
      >
        <PlaySVG />
        Google Play
      </a>
    </div>
  )
}
