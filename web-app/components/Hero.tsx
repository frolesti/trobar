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
          <span className="eyebrow">L&apos;app dels culers</span>
          <h1 style={{ marginBottom: 24 }}>
            Troba <em style={{ color: 'var(--gold)', fontWeight: 500 }}>on veure</em><br />
            el Barça
          </h1>
          <p style={{ fontSize: 19, maxWidth: 500, marginBottom: 40 }}>
            Bars verificats que emeten els partits del FC&nbsp;Barcelona a prop teu.
            Horaris, ambient i pantalles — tot en una app.
          </p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer" className="btn-slab">
              Descarrega a iOS
            </a>
            <a href="https://play.google.com" target="_blank" rel="noopener noreferrer" className="btn-ghost">
              Descarrega a Android
            </a>
          </div>
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
        }
      `}</style>
    </section>
  )
}
