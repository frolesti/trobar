import Head from 'next/head'
import Header from '../components/Header'
import Hero from '../components/Hero'
import Features from '../components/Features'
import Pricing from '../components/Pricing'
import Footer from '../components/Footer'

export default function Home() {
  return (
    <>
      <Head>
        <title>troBar — Troba on veure el Barça</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />
      <Hero />
      
      <main className="container" style={{maxWidth: 1200, margin: '0 auto', padding: '40px 24px'}}>
        <section id="com-funciona" style={{marginTop: 80}}>
          <h2 style={{fontSize: 36, marginBottom: 16, color: '#fff'}}>Com funciona</h2>
          <p style={{color:'rgba(255,255,255,0.7)', fontSize: 18, maxWidth: 600}}>Obre l'aplicació, mira el mapa i troba els bars més propers que retransmeten el partit d'avui. Filtra per ambient, preu o promocions especials.</p>
        </section>

        <div id="caracteristiques">
          <Features />
        </div>

        <Pricing />
      </main>

      <Footer />
    </>
  )
}
