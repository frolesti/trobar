import Link from 'next/link'
import styles from '../styles/Hero.module.css'

export default function Hero() {
  return (
    <section id="intro" className={styles.hero} aria-label="Hero">
      <div className={styles.container}>
        <div className={styles.left}>
          <span className={styles.badge}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            L&apos;app dels culers de Barcelona
          </span>
          <h1 className={styles.title}>
            Troba on veure<br/>
            <span style={{background: 'linear-gradient(90deg, var(--gold), #ffd54f)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>el Barça</span>
          </h1>
          <p className={styles.description}>
            Descobreix bars verificats que emeten els partits del FC Barcelona a prop teu. Horaris, ambient, pantalles — tot en una app.
          </p>

          <div className={styles.ctaWrapper} style={{display:'flex', gap:14, marginBottom:40, flexWrap:'wrap'}}>
            <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer" className={styles.ctaPrimary} style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04))',
              backdropFilter: 'blur(20px)',
              color:'#fff', fontWeight:600, fontSize:15, padding:'16px 28px', borderRadius:16,
              display:'flex', alignItems:'center', gap:14, textDecoration:'none',
              border:'1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}>
              <svg width="24" height="24" viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
              <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start'}}>
                <span style={{fontSize:11, fontWeight:400, lineHeight:1, opacity:0.6}}>Disponible a</span>
                <span style={{fontSize:16, lineHeight:1, marginTop:3, fontWeight:600}}>App Store</span>
              </div>
            </a>
            <a href="https://play.google.com" target="_blank" rel="noopener noreferrer" className={styles.ctaSecondary} style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04))',
              backdropFilter: 'blur(20px)',
              color:'#fff', fontWeight:600, fontSize:15, padding:'16px 28px', borderRadius:16,
              display:'flex', alignItems:'center', gap:14, textDecoration:'none',
              border:'1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}>
              <svg width="24" height="24" viewBox="0 0 512 512" fill="currentColor"><path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/></svg>
              <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start'}}>
                <span style={{fontSize:11, fontWeight:400, lineHeight:1, opacity:0.6}}>Disponible a</span>
                <span style={{fontSize:16, lineHeight:1, marginTop:3, fontWeight:600}}>Google Play</span>
              </div>
            </a>
          </div>


        </div>

        <div className={styles.right}>
          <div className={styles.mockupPlaceholder}>
            <img src="/mockup.png" alt="troBar app" className={styles.image} />
          </div>
        </div>
      </div>
    </section>
  )
}
