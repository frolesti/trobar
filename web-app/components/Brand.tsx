import Link from 'next/link'
import Logo from './Logo'

interface BrandProps {
  size?: number;          // alçada del logo en px
  href?: string | null;   // null => no és link
  showWordmark?: boolean; // mostra "troBar" al costat del logo
}

/**
 * Identitat visual: logo oficial + wordmark "troBar" en una sola tipografia.
 * Sense efectes tipogràfics (ni cursives, ni punts intercalats).
 * El logo PNG sempre és el protagonista.
 */
export default function Brand({ size = 36, href = '/', showWordmark = true }: BrandProps) {
  const content = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.32),
        textDecoration: 'none',
        color: 'var(--paper)',
        lineHeight: 1,
      }}
    >
      <Logo size={size} />
      {showWordmark && (
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontWeight: 700,
            fontSize: Math.round(size * 0.62),
            letterSpacing: '-0.01em',
            color: 'var(--paper)',
          }}
        >
          troBar
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} aria-label="troBar — inici" style={{ display: 'inline-flex' }}>
      {content}
    </Link>
  );
}
