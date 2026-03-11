import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="footer" style={{background: 'var(--footer-bg)', padding: '64px 24px 40px', color: '#fff', borderTop: '1px solid #2a2a4e'}}>
      <div className="container" style={{maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '60px', justifyContent: 'space-between'}}>
        <div className="footer-brand" style={{flex: '1 1 200px'}}>
          <Link href="/" style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, textDecoration: 'none'}}>
            <img src="/logo.png" alt="troBar" width={48} height={48} style={{borderRadius: '50%'}} />
            <span style={{fontSize: 28, fontWeight: 800, color: '#fff', fontFamily: 'Lora, serif'}}>troBar</span>
          </Link>
          <div style={{display: 'flex', gap: 16, marginTop: 32}}>
            <a href="#" style={{display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', padding: '8px 12px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14}}>
              <svg width="16" height="16" viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
              App Store
            </a>
            <a href="#" style={{display: 'flex', alignItems: 'center', gap: 8, background: 'var(--blue)', color: '#fff', padding: '8px 12px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14}}>
              <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor"><path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/></svg>
              Google Play
            </a>
          </div>
        </div>

        <div style={{display: 'flex', gap: '60px', flexWrap: 'wrap'}}>
          <div>
            <h4 style={{color: '#fff', marginBottom: 20, fontSize: 16, fontWeight: 700}}>Navegació</h4>
            <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
              <li style={{marginBottom: 12}}><Link href="/#com-funciona" style={{color: '#a8b0c0', textDecoration: 'none', transition: 'color 0.2s'}}>Com funciona</Link></li>
              <li style={{marginBottom: 12}}><Link href="/registra-bar" style={{color: '#a8b0c0', textDecoration: 'none', transition: 'color 0.2s'}}>Ets un bar?</Link></li>
            </ul>
          </div>

          <div>
            <h4 style={{color: '#fff', marginBottom: 20, fontSize: 16, fontWeight: 700}}>Contacte</h4>
            <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
              <li style={{marginBottom: 12}}><a href="#" style={{color: '#a8b0c0', textDecoration: 'none', transition: 'color 0.2s'}}>Centre d'ajuda</a></li>
              <li style={{marginBottom: 12}}><a href="#" style={{color: '#a8b0c0', textDecoration: 'none', transition: 'color 0.2s'}}>Suport a bars</a></li>
            </ul>
          </div>

          <div>
            <h4 style={{color: '#fff', marginBottom: 20, fontSize: 16, fontWeight: 700}}>Segueix-nos</h4>
            <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
              <li style={{marginBottom: 12}}><a href="#" style={{color: '#a8b0c0', textDecoration: 'none', transition: 'color 0.2s'}}>Instagram</a></li>
              <li style={{marginBottom: 12}}><a href="#" style={{color: '#a8b0c0', textDecoration: 'none', transition: 'color 0.2s'}}>Twitter</a></li>
              <li style={{marginBottom: 12}}><a href="#" style={{color: '#a8b0c0', textDecoration: 'none', transition: 'color 0.2s'}}>TikTok</a></li>
            </ul>
          </div>
        </div>
      </div>
      
      <div style={{maxWidth: 1200, margin: '60px auto 0', padding: '24px 0 0', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', color: '#8888a0', fontSize: 14}}>
        <div>© {new Date().getFullYear()} troBar. Tots els drets reservats.</div>
        <div style={{display: 'flex', gap: 24}}>
          <a href="/termes-condicions" style={{color: '#8888a0', textDecoration: 'none'}}>Termes i condicions</a>
          <a href="/politica-privacitat" style={{color: '#8888a0', textDecoration: 'none'}}>Política de privacitat</a>
        </div>
      </div>
    </footer>
  )
}
