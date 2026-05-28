import Link from 'next/link'
import Brand from './Brand'

/**
 * Footer transparent — el degradat del body flueix fins al final.
 * Només una hairline superior i les columnes amb tipografia editorial.
 */
export default function Footer() {
  const linkStyle = { color: 'var(--paper-faint)', fontSize: 14, fontFamily: 'var(--font-ui)' }
  const h4Style = {
    color: 'var(--paper)', marginBottom: 16, fontSize: 13, fontWeight: 600,
    textTransform: 'uppercase' as const, letterSpacing: 2,
  }

  return (
    <footer style={{
      padding: '80px 24px 48px',
      color: 'var(--paper)',
      borderTop: '1px solid var(--hairline)',
      position: 'relative',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 48,
          justifyContent: 'space-between', marginBottom: 48,
        }}>
          <div style={{ flex: '1 1 300px', maxWidth: 340 }}>
            <div style={{ marginBottom: 18 }}>
              <Brand size={40} />
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--paper-mute)', margin: 0 }}>
              L&apos;app per trobar on veure el Barça. Bars verificats, partits en directe
              i la millor comunitat culer.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
            <div>
              <h4 style={h4Style}>Producte</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <li><Link href="/#com-funciona" style={linkStyle}>Com funciona</Link></li>
                <li><Link href="/per-a-bars" style={linkStyle}>Per a bars</Link></li>
                <li><Link href="/per-a-bars#preus" style={linkStyle}>Preus</Link></li>
              </ul>
            </div>

            <div>
              <h4 style={h4Style}>Contacte</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <li><a href="mailto:hola@trobar-app.cat" style={linkStyle}>hola@trobar-app.cat</a></li>
                <li><a href="https://www.instagram.com/trobarapp/" target="_blank" rel="noopener noreferrer" style={linkStyle}>Instagram</a></li>
                <li><Link href="/contacte" style={linkStyle}>Formulari</Link></li>
              </ul>
            </div>

            <div>
              <h4 style={h4Style}>Legal</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <li><Link href="/termes-condicions" style={linkStyle}>Termes del servei</Link></li>
                <li><Link href="/politica-privacitat" style={linkStyle}>Política de privacitat</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <hr className="hr-editorial" />
        <div style={{
          paddingTop: 24, display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12,
        }}>
          <span style={{ color: 'var(--paper-faint)', fontSize: 13 }}>
            © {new Date().getFullYear()} troBar · Producte de{' '}
            <a
              href="https://frolesti.cat"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--gold)', fontStyle: 'normal', fontWeight: 700 }}
            >
              frolesti
            </a>
          </span>
          <span style={{ color: 'var(--paper-faint)', fontSize: 13 }}>
            v1.3.0
          </span>
        </div>
      </div>
    </footer>
  )
}
