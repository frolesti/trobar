import Link from 'next/link'
import { useState } from 'react'
import Logo from './Logo'
import LegalModal from './LegalModal'

type LegalType = 'privacy' | 'terms'

export default function Footer() {
  const [legalOpen, setLegalOpen] = useState<LegalType | null>(null)

  return (
    <>
    <footer className="footer" style={{background: 'var(--footer-bg)', padding: '64px 24px 40px', color: '#fff', borderTop: '1px solid rgba(255,255,255,0.06)'}}>
      <div style={{maxWidth: 1200, margin: '0 auto'}}>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '48px', justifyContent: 'space-between', marginBottom: 48}}>
          {/* Brand */}
          <div style={{flex: '1 1 280px', maxWidth: 320}}>
            <Link href="/" style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, textDecoration: 'none'}}>
              <Logo size={36} color="#fff" />
              <span style={{fontSize: 24, fontWeight: 800, color: '#fff', fontFamily: 'Lora, serif'}}>troBar</span>
            </Link>
            <p style={{color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px'}}>
              L&apos;app per trobar on veure el Barça. Bars verificats, partits en directe i la millor comunitat culer.
            </p>
            <div style={{display: 'flex', gap: 12}}>
              <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer" style={{display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '8px 14px', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 13, border: '1px solid rgba(255,255,255,0.08)', transition: 'background 0.2s'}}>
                <svg width="14" height="14" viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
                App Store
              </a>
              <a href="https://play.google.com" target="_blank" rel="noopener noreferrer" style={{display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '8px 14px', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 13, border: '1px solid rgba(255,255,255,0.08)', transition: 'background 0.2s'}}>
                <svg width="14" height="14" viewBox="0 0 512 512" fill="currentColor"><path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/></svg>
                Google Play
              </a>
            </div>
          </div>

          {/* Navigation columns */}
          <div style={{display: 'flex', gap: '56px', flexWrap: 'wrap'}}>
            <div>
              <h4 style={{color: '#fff', marginBottom: 16, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5}}>Producte</h4>
              <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                <li style={{marginBottom: 10}}><Link href="/#com-funciona" style={{color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 14, transition: 'color 0.2s'}}>Com funciona</Link></li>
                <li style={{marginBottom: 10}}><Link href="/per-a-bars" style={{color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 14, transition: 'color 0.2s'}}>Per a bars</Link></li>
                <li style={{marginBottom: 10}}><Link href="/per-a-bars#preus" style={{color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 14, transition: 'color 0.2s'}}>Preus</Link></li>
              </ul>
            </div>

            <div>
              <h4 style={{color: '#fff', marginBottom: 16, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5}}>Contacte</h4>
              <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                <li style={{marginBottom: 10}}><a href="mailto:hola@trobar.app" style={{color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 14}}>hola@trobar.app</a></li>
                <li style={{marginBottom: 10}}><a href="https://www.instagram.com/trobarapp/" target="_blank" rel="noopener noreferrer" style={{color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 14}}>Instagram</a></li>
                <li style={{marginBottom: 10}}><Link href="/contacte" style={{color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 14}}>Formulari de contacte</Link></li>
              </ul>
            </div>

            <div>
              <h4 style={{color: '#fff', marginBottom: 16, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5}}>Legal</h4>
              <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                <li style={{marginBottom: 10}}><button onClick={() => setLegalOpen('terms')} style={{color: 'rgba(255,255,255,0.5)', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', padding: 0}}>Termes i condicions</button></li>
                <li style={{marginBottom: 10}}><button onClick={() => setLegalOpen('privacy')} style={{color: 'rgba(255,255,255,0.5)', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', padding: 0}}>Política de privacitat</button></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12}}>
          <span style={{color: 'rgba(255,255,255,0.35)', fontSize: 13}}>© {new Date().getFullYear()} troBar. Tots els drets reservats.</span>
          <span style={{color: 'rgba(255,255,255,0.25)', fontSize: 12}}>Fet a Barcelona amb ❤️</span>
        </div>
      </div>
    </footer>

    {legalOpen && <LegalModal type={legalOpen} onClose={() => setLegalOpen(null)} />}
    </>
  )
}
