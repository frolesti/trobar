import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--hairline)',
      padding: '56px 48px 32px',
      background: 'var(--black)',
    }}>
      <div className="footer-top" style={{
        maxWidth: 1160,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
        gap: 40,
        marginBottom: 44,
      }}>
        {/* Marca */}
        <div>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--cream)',
            margin: '0 0 16px',
          }}>
            troBar
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.8, maxWidth: 260, margin: 0 }}>
            El mapa col·laboratiu per trobar on veure el Barça, fet pels culers i per als culers.
          </p>
        </div>

        {/* Producte */}
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--gold)', margin: '0 0 20px' }}>
            Producte
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <li><Link href="/#com-funciona" style={{ fontSize: 14, color: 'var(--cream-70)' }}>Com funciona</Link></li>
            <li><Link href="/per-a-bars" style={{ fontSize: 14, color: 'var(--cream-70)' }}>Per a bars</Link></li>
            <li><Link href="/per-a-bars#preus" style={{ fontSize: 14, color: 'var(--cream-70)' }}>Preus</Link></li>
          </ul>
        </div>

        {/* Contacte */}
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--gold)', margin: '0 0 20px' }}>
            Contacte
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <li><a href="mailto:hola@trobar-app.cat" style={{ fontSize: 14, color: 'var(--cream-70)' }}>hola@trobar-app.cat</a></li>
            <li><a href="https://www.instagram.com/trobarapp/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--cream-70)' }}>Instagram</a></li>
            <li><Link href="/contacte" style={{ fontSize: 14, color: 'var(--cream-70)' }}>Formulari</Link></li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--gold)', margin: '0 0 20px' }}>
            Legal
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <li><Link href="/termes-condicions" style={{ fontSize: 14, color: 'var(--cream-70)' }}>Termes del servei</Link></li>
            <li><Link href="/politica-privacitat" style={{ fontSize: 14, color: 'var(--cream-70)' }}>Política de privacitat</Link></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom" style={{ borderTop: '1px solid var(--hairline)', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--cream-40)' }}>
          © {new Date().getFullYear()} troBar · Producte de{' '}
          <a href="https://frolesti.cat" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', fontWeight: 600 }}>
            frolesti
          </a>
        </span>
        <span style={{ fontSize: 12, color: 'var(--cream-40)' }}>
          troBar — Tots els drets reservats
        </span>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.footer-top) {
            gap: 28px !important;
            margin-bottom: 32px !important;
          }
        }
        @media (max-width: 768px) {
          footer {
            padding: 44px 20px 24px !important;
          }
          :global(.footer-grid) {
            grid-template-columns: 1fr 1fr !important;
          }
          :global(.footer-bottom) {
            padding-top: 16px !important;
          }
        }
        @media (max-width: 480px) {
          footer {
            padding: 40px 18px 22px !important;
          }
          :global(.footer-grid) {
            grid-template-columns: 1fr !important;
          }
          :global(.footer-top) {
            margin-bottom: 24px !important;
          }
          :global(.footer-bottom) {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
        }
      `}</style>
    </footer>
  )
}
