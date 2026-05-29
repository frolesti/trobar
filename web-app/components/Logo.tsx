/**
 * Component d'imatge per al logo oficial de troBar (PNG branding).
 * Usa el mateix asset que la build d'Android/iOS perquè la identitat
 * sigui idèntica a tot arreu.
 */
interface LogoProps {
  size?: number;
  visualScale?: number;
  variant?: 'red' | 'white';
  maskCircle?: boolean;
  animated?: boolean;
}

export default function Logo({
  size = 56,
  visualScale = 1.42,
  variant = 'red',
  maskCircle,
  animated = false,
}: LogoProps) {
  const src = variant === 'white' ? '/assets/logos/logo-white.png' : '/assets/logos/logo-red.png'
  const animatedSrc = '/assets/gif/trobar.gif'
  const useMask = maskCircle ?? (variant === 'red')

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
        src={animated ? animatedSrc : src}
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
