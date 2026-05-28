/**
 * troBar mark — un punt rodó amb l'agulla del mapa interior.
 * S'usa dins del wordmark com a "punt" entre 'tro' i 'Bar'.
 */
export default function Logo({ size = 40, color = 'var(--gold)' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <circle cx="32" cy="32" r="28" fill={color} />
      <circle cx="32" cy="32" r="9" fill="var(--paper)" />
    </svg>
  );
}
