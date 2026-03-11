import Link from 'next/link'
import styles from '../styles/Hero.module.css'

export default function Hero() {
  return (
    <section id="intro" className={styles.hero} aria-label="Hero">
      <div className={styles.container}>
        <div className={styles.left}>
          <span className={styles.badge} style={{background:'#F7EDD5',color:'#4b4b2f',fontWeight:600,padding:'10px 18px',borderRadius:999,boxShadow:'0 8px 24px rgba(2,6,23,0.06)',fontSize:18,marginBottom:18,display:'inline-block'}}>Més de 10.000 culers ja l'utilitzen</span>
          <h1 className={styles.title} style={{fontSize:'clamp(44px,8vw,88px)',fontWeight:800,marginBottom:18,lineHeight:0.98}}>Troba on veure el Barça</h1>
          <p className={styles.description} style={{fontSize:22,maxWidth:540,marginBottom:28}}>Descobreix els millors bars i restaurants per veure els partits del FC Barcelona. Viu l'ambient, consulta els horaris i no et perdis cap gol amb troBar!</p>

          <div className={styles.ctaWrapper} style={{display:'flex',gap:18,marginBottom:32}}>
            <Link href="#download" className={styles.ctaPrimary} style={{background:'var(--accent)',color:'#fff',fontWeight:600,fontSize:18,padding:'16px 32px',borderRadius:999,boxShadow:'0 10px 26px var(--shadow)', display: 'flex', alignItems: 'center', gap: 12}}>
              <svg width="24" height="24" viewBox="0 0 384 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
                <span style={{fontSize: 12, fontWeight: 400, lineHeight: 1}}>Descarrega-ho des de l'</span>
                <span style={{fontSize: 20, lineHeight: 1, marginTop: 4}}>App Store</span>
              </div>
            </Link>
            <Link href="#buy" className={styles.ctaSecondary} style={{background:'var(--blue)',color:'#fff',fontWeight:600,fontSize:18,padding:'16px 32px',borderRadius:999,boxShadow:'0 10px 26px var(--shadow)', display: 'flex', alignItems: 'center', gap: 12}}>
              <svg width="24" height="24" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/></svg>
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
                <span style={{fontSize: 12, fontWeight: 400, lineHeight: 1}}>DESCOBREIX-LO A</span>
                <span style={{fontSize: 20, lineHeight: 1, marginTop: 4}}>Google Play</span>
              </div>
            </Link>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.mockupPlaceholder} style={{position:'relative', padding: '24px', overflow: 'visible', border: 'none', background: 'transparent'}}>
            <img src="/mockup.png" alt="mockup" className={styles.image} />
          </div>
        </div>
      </div>
    </section>
  )
}
