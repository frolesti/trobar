/**
 * Component d'imatge per al logo oficial de troBar (PNG branding).
 * Usa el mateix asset que la build d'Android/iOS perquè la identitat
 * sigui idèntica a tot arreu.
 */
interface LogoProps {
  size?: number;
}

export default function Logo({ size = 56 }: LogoProps) {
  return (
    <img
      src="/trobar-logo-round.png"
      alt="troBar"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        display: 'block',
        objectFit: 'contain',
      }}
    />
  );
}
