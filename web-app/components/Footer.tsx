import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export default function Footer() {
  const [isMobile, setIsMobile] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>(null)
  const longPressTriggeredRef = useRef(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const sync = () => setIsMobile(window.innerWidth <= 768)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  const startHold = (key: string) => {
    if (!isMobile) return
    longPressTriggeredRef.current = false
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    holdTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      setOpenSection(prev => (prev === key ? null : key))
    }, 380)
  }

  const endHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const blockTap = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isMobile && !longPressTriggeredRef.current) {
      e.preventDefault()
    }
  }

  return (
    <footer style={{
      borderTop: '1px solid var(--hairline)',
      padding: '56px 48px 32px',
      background: 'var(--black)',
    }}>
      <div className="footer-top footer-desktop" style={{
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

      <div className="footer-mobile" style={{ maxWidth: 1160, margin: '0 auto 24px' }}>
        <div className="footer-mobile-help">Mantén premut per desplegar</div>

        <div className="footer-mobile-row">
          <button
            type="button"
            className="footer-mobile-title"
            onTouchStart={() => startHold('producte')}
            onTouchEnd={endHold}
            onTouchCancel={endHold}
            onMouseDown={() => startHold('producte')}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onClick={blockTap}
          >
            Producte
          </button>
          {openSection === 'producte' && (
            <ul className="footer-mobile-list">
              <li><Link href="/#com-funciona">Com funciona</Link></li>
              <li><Link href="/per-a-bars">Per a bars</Link></li>
              <li><Link href="/per-a-bars#preus">Preus</Link></li>
            </ul>
          )}
        </div>

        <div className="footer-mobile-row">
          <button
            type="button"
            className="footer-mobile-title"
            onTouchStart={() => startHold('contacte')}
            onTouchEnd={endHold}
            onTouchCancel={endHold}
            onMouseDown={() => startHold('contacte')}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onClick={blockTap}
          >
            Contacte
          </button>
          {openSection === 'contacte' && (
            <ul className="footer-mobile-list">
              <li><a href="mailto:hola@trobar-app.cat">hola@trobar-app.cat</a></li>
              <li><a href="https://www.instagram.com/trobarapp/" target="_blank" rel="noopener noreferrer">Instagram</a></li>
              <li><Link href="/contacte">Formulari</Link></li>
            </ul>
          )}
        </div>

        <div className="footer-mobile-row">
          <button
            type="button"
            className="footer-mobile-title"
            onTouchStart={() => startHold('legal')}
            onTouchEnd={endHold}
            onTouchCancel={endHold}
            onMouseDown={() => startHold('legal')}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onClick={blockTap}
          >
            Legal
          </button>
          {openSection === 'legal' && (
            <ul className="footer-mobile-list">
              <li><Link href="/termes-condicions">Termes del servei</Link></li>
              <li><Link href="/politica-privacitat">Política de privacitat</Link></li>
            </ul>
          )}
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
        :global(.footer-mobile-help) {
          font-size: 11px;
          color: var(--cream-40);
          margin-bottom: 10px;
        }
        :global(.footer-mobile-row) {
          border-top: 1px solid var(--hairline);
          padding: 10px 0;
        }
        :global(.footer-mobile-title) {
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
            padding: 44px 20px 24px !important;
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
            padding: 40px 18px 22px !important;
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
