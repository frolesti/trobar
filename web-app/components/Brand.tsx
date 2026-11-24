import Link from 'next/link'
import Logo from './Logo'
import Wordmark from './Wordmark'

interface BrandProps {
  size?: number;          // alçada del logo en px
  href?: string | null;   // null => no és link
  showWordmark?: boolean;
}

export default function Brand({ size = 36, href = '/', showWordmark = true }: BrandProps) {
  const content = (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        textDecoration: 'none',
        color: 'var(--paper)',
        lineHeight: 1,
      }}
    >
      <Logo size={size} />
      {showWordmark && (
        <Wordmark width={Math.round(size * 1.9)} decorative />
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
