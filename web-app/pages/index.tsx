import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Hero from '../components/Hero'
import Footer from '../components/Footer'
import StoreBadges from '../components/StoreBadges'
import BackgroundVideo from '../components/BackgroundVideo'
import styles from '../styles/Home.module.css'

const steps = [
  { title: 'Obre l’app', text: 'Descarrega troBar i permet que detecti la teva ubicació. En deu segons tens el mapa actiu.' },
  { title: 'Busca al mapa', text: 'Veu tots els bars propers que emeten el Barça avui. Toca qualsevol punter per veure’n els detalls.' },
  { title: 'Gaudeix del partit', text: 'Tria el bar que més t’agradi i gaudeix del Barça com es mereix: envoltat de la millor afició.' },
]

export default function Home() {
  return (
    <>
      <Head>
        <title>troBar — Troba on veure el Barça</title>
        <meta name="description" content="El mapa col·laboratiu dels culers. Descobreix on emeten el Barça prop teu." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <a className={styles.skipLink} href="#contingut">Salta al contingut</a>
      <Header />
      <main id="contingut" className={styles.home}>
        <Hero />
        <section id="qui-som" className={styles.manifesto}>
          <span className="eyebrow">Qui som</span>
          <h2>El bar de sempre<br /><em>ara al teu mòbil</em></h2>
          <p>troBar és un mapa fet pels culers i per als culers. La comunitat marca on es veu cada partit, confirma horaris i valora l’ambient. Tu tries on viure-ho.</p>
        </section>
        <section id="app" className={styles.split}>
          <div className={styles.media}><BackgroundVideo name="glasses-beer" /></div>
          <div className={styles.copy}>
            <span className="eyebrow">L’app</span>
            <h2>Busca, troba,<br />gaudeix</h2>
            <p>Obre el mapa i veu al moment quins bars propers emeten el Barça avui. Filtra per zona, llegeix valoracions i escull el teu lloc.</p>
            <p>Cada barra del mapa ha estat afegida per un culer real. Sense directoris buits, sense informació desactualitzada.</p>
          </div>
        </section>
        <section id="comunitat" className={`${styles.split} ${styles.community}`}>
          <div className={styles.copy}>
            <span className="eyebrow">Comunitat</span>
            <h2>La millor penya<br /><em>ets tu</em></h2>
            <p>troBar creix gràcies als culers. Afegeix bars nous, confirma que emeten el pròxim partit i deixa la teva valoració perquè els altres sàpiguen quin ambient hi ha.</p>
            <p>Com més culers hi participen, millor és el mapa per a tothom.</p>
          </div>
          <div className={styles.media}><BackgroundVideo name="community" /></div>
        </section>
        <section id="com-funciona" className={styles.how}>
          <div className={styles.container}>
            <span className="eyebrow">Com funciona</span>
            <h2>Tres passos,<br />un bar</h2>
            <ol>{steps.map(step => <li key={step.title}><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
          </div>
        </section>
        <section id="descarrega" className={styles.download}>
          <span className="eyebrow">Descarrega</span>
          <h2>L’app de troBar<br /><em>al teu mòbil</em></h2>
          <StoreBadges center />
        </section>
        <section id="per-a-bars" className={styles.bars}>
          <img src="/assets/img/bar-fallout.jpg" alt="Ambient de bar" />
          <div>
            <span className="eyebrow">Per a bars i restaurants</span>
            <h2>Tens un bar on<br /><em>es veu el Barça</em>?</h2>
            <p>Apareix al mapa que fan servir milers de culers cada dia de partit. Registra el teu local i converteix l’afició en clients fidels.</p>
            <Link href="/per-a-bars" className="btn">Descobreix com</Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
