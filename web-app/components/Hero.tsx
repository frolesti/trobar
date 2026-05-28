import StoreBadges from './StoreBadges'

/**
 * Hero amb fons granat sòlid (mateix to que el cercle del logo)
 * perquè el logo es vegi "sense fons", integrat al panell superior.
 * No repeteix el wordmark (ja el porta el Header).
 */
export default function Hero() {
  return (
    <section
      id="intro"
      aria-label="Hero"
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        padding: '140px 0 80px',
        // Transicio integrada al propi hero per evitar qualsevol tall visible
        background:
          'linear-gradient(to bottom, var(--grana) 0%, var(--grana) 56%, rgba(165,0,68,0.88) 72%, rgba(13,27,42,0) 100%)',
      }}
    >
      <div
        className="hero-grid"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 60,
          alignItems: 'center',
          width: '100%',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div className="fade-up">
          {/* Logo gran, sense wordmark — el cercle granat es fon amb el fons */}
          <div style={{ marginBottom: 36 }}>
            <img
              src="/trobar-logo-round.png"
              alt="troBar"
              width={180}
              height={180}
              style={{ display: 'block', width: 180, height: 180 }}
            />
          </div>

          <h1 style={{ marginBottom: 24 }}>
            Troba <span style={{ color: 'var(--gold)' }}>on veure</span> el Barça
          </h1>
          <p style={{ fontSize: 19, maxWidth: 520, marginBottom: 40 }}>
            Mapa col·laboratiu de bars on els culers veuen els partits del Barça.
            La comunitat afegeix bars, valora-hi l&apos;ambient i confirma quins emeten cada jornada.
          </p>

          <StoreBadges />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <img
            src="/mockup.png"
            alt="troBar mostrant un mapa de bars amb el partit del Barça"
            style={{
              width: '100%',
              maxWidth: 340,
              filter: 'drop-shadow(0 30px 70px rgba(0,0,0,0.55))',
              animation: 'fadeUp 1s ease-out both',
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.hero-grid) {
            grid-template-columns: 1fr !important;
            text-align: center;
            gap: 40px !important;
          }
          :global(.hero-grid h1 br) { display: none; }
          :global(.hero-grid > div:first-child > div:first-child) {
            display: flex;
            justify-content: center;
          }
        }
      `}</style>
    </section>
  )
}
