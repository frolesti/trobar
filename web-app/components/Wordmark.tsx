export default function Wordmark({
  width = 140,
  variant = 'grana',
  decorative = false,
}: {
  width?: number
  variant?: 'grana' | 'cream'
  decorative?: boolean
}) {
  return (
    <img
      src={`/assets/logos/wordmark-${variant}.svg`}
      width={width}
      height={width * 100 / 280}
      alt={decorative ? '' : 'troBar'}
      aria-hidden={decorative || undefined}
      style={{ display: 'block', flexShrink: 0 }}
    />
  )
}
