interface LogoProps {
  size?: number;
  visualScale?: number;
  variant?: 'red' | 'white';
  maskCircle?: boolean;
}

export default function Logo({
  size = 56,
  visualScale = 1,
  variant = 'red',
  maskCircle,
}: LogoProps) {
  const src = variant === 'white' ? '/assets/logos/mascot-ball-cream.png' : '/assets/logos/mascot-ball-grana.png'
  const useMask = maskCircle ?? false

  return (
    <span
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        overflow: useMask ? 'hidden' : 'visible',
        borderRadius: useMask ? '50%' : 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={src}
        alt="troBar"
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          display: 'block',
          objectFit: 'contain',
          transform: `scale(${visualScale})`,
          transformOrigin: 'center',
        }}
      />
    </span>
  );
}
