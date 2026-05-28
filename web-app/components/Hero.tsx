import Brand from './Brand'
import StoreBadges from './StoreBadges'

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
      }}
    >
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 24px',
        display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 60,
        alignItems: 'center', width: '100%',
      }} className="hero-grid">
        <div className="fade-up">
          <div style={{ marginBottom: 28 }}>
            <Brand size={64} href={null} />
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

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <img
            src="/mockup.png"
            alt="troBar mostrant un mapa de bars amb el partit del Barça"
            style={{
              width: '100%', maxWidth: 340,
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
