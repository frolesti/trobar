import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Pricing from '../components/Pricing'
import Footer from '../components/Footer'

export default function PerABars() {
  return (
    <>
      <Head>
        <title>troBar — Per a Bars i Restaurants</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Dona d’alta el teu bar a troBar perquè els culers sàpiguen on veure el partit." />
      </Head>
      <Header />

      <main className="per-a-bars-page" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="per-a-bars-content" style={{ position: 'relative', zIndex: 1 }}>
        {/* Hero per a bars */}
        <section className="per-a-bars-hero" style={{ padding: '120px 24px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', zIndex: 1 }} className="fade-up per-a-bars-hero-inner">
            <h1 style={{ marginBottom: 24 }}>
              Converteix cada partit <em style={{ color: 'var(--gold)', fontWeight: 500 }}>en clients</em>
            </h1>
            <p style={{ fontSize: 19, maxWidth: 520, margin: '0 auto 40px' }}>
              Si al teu bar es veu el Barça, explica-ho a troBar. Els culers podran trobar el local, consultar els partits que hi emets i conèixer-ne l’ambient.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/registra-bar" className="btn-slab">Registra el teu local</Link>
              <a href="#preus" className="btn-ghost">Veure plans</a>
            </div>
          </div>
        </section>

        {/* Preus */}
        <section className="per-a-bars-preus" style={{ padding: '48px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <Pricing />
          </div>
        </section>

        {/* CTA final */}
        <section className="per-a-bars-cta" style={{ textAlign: 'center', padding: '40px 24px 48px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <h2 style={{ marginBottom: 20 }}>
              Comença <em style={{ color: 'var(--gold)', fontWeight: 500 }}>avui</em>
            </h2>
            <p style={{ maxWidth: 460, margin: '0 auto 36px', fontSize: 17 }}>
              Prova Premium durant 14 dies. Abans del primer cobrament, pots decidir si vols continuar.
            </p>
            <Link href="/registra-bar" className="btn-slab">
              Registra el teu local
            </Link>
          </div>
        </section>
        </div>
      </main>

      <Footer />
    </>
  )
}
