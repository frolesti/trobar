import StoreBadges from './StoreBadges'
import Logo from './Logo'

export default function Hero() {
  return (
    <section
      id="intro"
      className="hero-section"
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        textAlign: 'center',
        overflow: 'hidden',
        padding: '132px 24px 48px',
      }}
    >
      {/* ── Fons: substituir per foto/vídeo ── */}
      <div
        style={{ position: 'absolute', inset: 0, zIndex: 0 }}
        aria-hidden="true"
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        >
          <source src="/assets/videos/canopy.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Overlay fosc per llegibilitat */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'rgba(12,12,12,0.62)',
      }} aria-hidden="true" />

      {/* Gradient inferior de transició */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 220, zIndex: 2, pointerEvents: 'none',
        background: 'linear-gradient(to bottom, transparent 0%, var(--black) 100%)',
      }} aria-hidden="true" />

      {/* Contingut */}
      <div className="fade-up" style={{ position: 'relative', zIndex: 3, maxWidth: 860, width: '100%' }}>
        <div className="hero-logo-wrap" style={{ margin: '0 auto 26px', width: 'fit-content' }}>
          <Logo size={220} visualScale={1.08} variant="white" maskCircle={false} />
        </div>

        <h1 className="hero-title" style={{ marginBottom: 20, fontSize: 'clamp(48px, 10vw, 112px)' }}>
          Troba on veure<br />el Barça
        </h1>

        <p className="hero-copy" style={{
          fontSize: 18,
          maxWidth: 480,
          margin: '0 auto 52px',
          color: 'var(--cream-70)',
        }}>
          El mapa col·laboratiu dels culers. Descobreix on emeten el partit,
          valora l&apos;ambient i no et perdis cap jugada.
        </p>

        <div className="hero-cta" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <StoreBadges center />
        </div>
      </div>
    </section>
  )
}
