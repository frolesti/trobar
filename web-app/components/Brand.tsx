import Link from 'next/link'
import Logo from './Logo'

interface BrandProps {
  size?: number;          // alçada total en px del wordmark
  href?: string | null;   // null => no és link
  dotColor?: string;      // color del "punt" del logo
}

/**
 * Wordmark editorial de troBar:
 *    tro·Bar
 * - "tro" en cursiva fina (Lora italic 500)
 * - punt = mark del logo, ple de color gold/grana
 * - "Bar" en regular bold (Lora 800)
 *
 * S'usa al Header, Footer i als heros de les pàgines.
 */
export default function Brand({ size = 28, href = '/', dotColor = 'var(--gold)' }: BrandProps) {
  const dotSize = Math.round(size * 0.55);
  const content = (
    <span className="wordmark" style={{ fontSize: size }}>
      <span className="wordmark__tro">tro</span>
      <span className="wordmark__dot" style={{ width: dotSize, height: dotSize }}>
        <Logo size={dotSize} color={dotColor} />
      </span>
      <span className="wordmark__bar">Bar</span>
    </span>
  );

  if (!href) return content;
  return <Link href={href} aria-label="troBar — inici" style={{ display: 'inline-flex' }}>{content}</Link>;
}
