import BackgroundVideo from './BackgroundVideo'
import StoreBadges from './StoreBadges'
import styles from '../styles/Home.module.css'

export default function Hero() {
  return (
    <section id="intro" className={styles.hero}>
      <div className={styles.heroMedia}><BackgroundVideo name="canopy" /></div>
      <div className={styles.heroCopy}>
        <picture className={styles.heroLogo}>
          <source media="(prefers-reduced-motion: reduce)" srcSet="/assets/logos/mascot-ball-cream.png" />
          <img src="/assets/gif/trobar.gif" alt="troBar" width={160} height={160} />
        </picture>
        <h1>Troba on veure<br />el Barça</h1>
        <p>El mapa col·laboratiu dels culers. Descobreix on emeten el partit, valora l’ambient i no et perdis cap jugada.</p>
        <StoreBadges center />
      </div>
    </section>
  )
}
