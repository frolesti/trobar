import { useState } from 'react'
import Link from 'next/link'

export default function Footer() {
  const [openSection, setOpenSection] = useState<string | null>(null)

  const toggleSection = (key: string) => setOpenSection(prev => prev === key ? null : key)

  const chevron = (expanded: boolean) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
      style={{ transform: expanded ? 'rotate(180deg)' : undefined }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )

  return (
    <footer style={{
      borderTop: '1px solid var(--hairline)',
      padding: '36px 32px 24px',
      background: 'var(--black)',
    }}>
      <div className="footer-top footer-desktop" style={{
        maxWidth: 1160,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
        gap: 40,
        marginBottom: 24,
      }}>
        {/* Marca */}
        <div>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 400,
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

      <div className="footer-mobile" style={{ maxWidth: 1160, margin: '0 auto 16px' }}>
        <div className="footer-mobile-row">
          <button
            type="button"
            className="footer-mobile-title"
            aria-expanded={openSection === 'producte'}
            aria-controls="footer-producte-links"
            onClick={() => toggleSection('producte')}
          >
            Producte
            {chevron(openSection === 'producte')}
          </button>
            <ul id="footer-producte-links" className="footer-mobile-list" hidden={openSection !== 'producte'}>
              <li><Link href="/#com-funciona">Com funciona</Link></li>
              <li><Link href="/per-a-bars">Per a bars</Link></li>
              <li><Link href="/per-a-bars#preus">Preus</Link></li>
            </ul>
        </div>

        <div className="footer-mobile-row">
          <button
            type="button"
            className="footer-mobile-title"
            aria-expanded={openSection === 'contacte'}
            aria-controls="footer-contacte-links"
            onClick={() => toggleSection('contacte')}
          >
            Contacte
            {chevron(openSection === 'contacte')}
          </button>
            <ul id="footer-contacte-links" className="footer-mobile-list" hidden={openSection !== 'contacte'}>
              <li><a href="mailto:hola@trobar-app.cat">hola@trobar-app.cat</a></li>
              <li><a href="https://www.instagram.com/trobarapp/" target="_blank" rel="noopener noreferrer">Instagram</a></li>
              <li><Link href="/contacte">Formulari</Link></li>
            </ul>
        </div>

        <div className="footer-mobile-row">
          <button
            type="button"
            className="footer-mobile-title"
            aria-expanded={openSection === 'legal'}
            aria-controls="footer-legal-links"
            onClick={() => toggleSection('legal')}
          >
            Legal
            {chevron(openSection === 'legal')}
          </button>
            <ul id="footer-legal-links" className="footer-mobile-list" hidden={openSection !== 'legal'}>
              <li><Link href="/termes-condicions">Termes del servei</Link></li>
              <li><Link href="/politica-privacitat">Política de privacitat</Link></li>
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
        <span className="footer-bottom-mobile-single" style={{ fontSize: 12, color: 'var(--cream-40)', display: 'none' }}>
          © {new Date().getFullYear()} troBar · Producte de frolesti · Tots els drets reservats
        </span>
      </div>

      <style jsx>{`
        :global(.footer-mobile) {
          display: none;
        }
        :global(.footer-mobile-row) {
          border-top: 1px solid var(--hairline);
          padding: 6px 0;
        }
        :global(.footer-mobile-title) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 44px;
          width: 100%;
          background: transparent;
          border: none;
          text-align: left;
          padding: 4px 0;
          font-family: var(--font-body);
          font-size: 10px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--gold);
          cursor: pointer;
        }
        :global(.footer-mobile-list) {
          list-style: none;
          margin: 10px 0 4px;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        :global(.footer-mobile-list[hidden]) {
          display: none;
        }
        :global(.footer-mobile-list li a) {
          color: var(--cream-70);
          font-size: 14px;
        }
        @media (max-width: 900px) {
          :global(.footer-top) {
            gap: 28px !important;
            margin-bottom: 32px !important;
          }
        }
        @media (max-width: 768px) {
          footer {
            padding: 28px 20px 20px !important;
          }
          :global(.footer-desktop) {
            display: none !important;
          }
          :global(.footer-mobile) {
            display: block;
          }
          :global(.footer-bottom) {
            padding-top: 16px !important;
          }
        }
        @media (max-width: 480px) {
          footer {
            padding: 24px 18px 20px !important;
          }
          :global(.footer-bottom) {
            flex-direction: row !important;
            align-items: flex-start !important;
          }
          :global(.footer-bottom > span:not(.footer-bottom-mobile-single)) {
            display: none;
          }
          :global(.footer-bottom-mobile-single) {
            display: block !important;
          }
        }
      `}</style>
    </footer>
  )
}
