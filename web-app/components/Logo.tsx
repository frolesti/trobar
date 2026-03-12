/**
 * troBar SVG logo — map pin with a play button inside.
 * Fully vector, no external images. Uses brand colours from CSS vars.
 */
export default function Logo({ size = 40, color = 'var(--accent)' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Map pin shape */}
      <path
        d="M32 4C20.954 4 12 12.954 12 24c0 14 20 36 20 36s20-22 20-36C52 12.954 43.046 4 32 4z"
        fill={color}
      />
      {/* Inner circle */}
      <circle cx="32" cy="24" r="12" fill="#fff" />
      {/* Play triangle */}
      <polygon points="28,18 28,30 38,24" fill={color} />
    </svg>
  )
}
