/**
 * troBar mark — escut circular amb pin interior i nucli crema.
 * Ha de funcionar tant com a símbol protagonista com a punt del wordmark.
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
      <defs>
        <linearGradient id="trobarMark" x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor="var(--grana)" />
        </linearGradient>
      </defs>

      <circle cx="32" cy="32" r="28" fill="url(#trobarMark)" />

      <path
        d="M32 15C25.37 15 20 20.37 20 27c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12Z"
        fill="var(--paper)"
        fillOpacity="0.95"
      />
      <circle cx="32" cy="27" r="4.6" fill="var(--grana)" />
    </svg>
  );
}
