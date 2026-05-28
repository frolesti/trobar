import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Pricing from '../components/Pricing'
import Footer from '../components/Footer'

export default function PerABars() {
  const benefits = [
    { mark: 'V', title: 'Visibilitat al mapa',
      desc: 'El teu bar apareix destacat quan milers de culers busquen on veure el partit.' },
    { mark: 'P', title: 'Perfil verificat',
      desc: 'Insígnia verificada amb fotos, horaris reals i equipament confirmat.' },
    { mark: 'A', title: 'Anuncia partits',
      desc: 'Confirma quins partits emets i els culers propers ho veuran al moment.' },
    { mark: 'G', title: 'Galeria i equipament',
      desc: 'Publica fins a 10 fotos del local i destaca pantalles, projector i terrassa.' },
  ]

  return (
    <>
      <Head>
        <title>troBar — Per a Bars i Restaurants</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Registra el teu bar a troBar i atrau milers d'aficionats del Barça cada dia de partit." />
      </Head>
      <Header />

      <main>
        {/* Hero per a bars */}
        <section style={{ padding: '160px 24px 80px', textAlign: 'center' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }} className="fade-up">
            <span className="eyebrow">Per a bars i restaurants</span>
            <h1 style={{ marginBottom: 24 }}>
              Converteix cada partit <em style={{ color: 'var(--gold)', fontWeight: 500 }}>en clients</em>
            </h1>
            <p style={{ fontSize: 19, maxWidth: 520, margin: '0 auto 40px' }}>
              Milers de culers busquen on veure el Barça prop seu. Apareix al seu mapa amb un perfil verificat i omple el local cada jornada.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/registra-bar" className="btn-slab">Registra el teu local</Link>
              <a href="#preus" className="btn-ghost">Veure plans</a>
            </div>
          </div>
        </section>

        {/* Beneficis */}
        <section style={{ padding: '100px 24px 60px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <span className="eyebrow">Què inclou</span>
              <h2 style={{ marginBottom: 14 }}>
                Tot per fer créixer <em style={{ color: 'var(--gold)', fontWeight: 500 }}>el teu negoci</em>
              </h2>
              <p style={{ maxWidth: 460, margin: '0 auto', fontSize: 17 }}>
                Eines pensades perquè cada dia de partit sigui una oportunitat.
              </p>
            </div>

            <div className="two-col-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1,
              background: 'var(--hairline)',
              border: '1px solid var(--hairline)',
            }}>
              {benefits.map((b, i) => (
                <div key={i} style={{
                  padding: '40px 32px',
                  display: 'flex', gap: 26, alignItems: 'flex-start',
                  background: 'rgba(13,27,42,0.18)',
                  backdropFilter: 'blur(6px)',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-ui)', fontWeight: 500,
                    fontSize: 72, lineHeight: 0.8, color: 'var(--gold)',
                    flexShrink: 0, marginTop: 4,
                  }} aria-hidden>
                    {b.mark}
                  </span>
                  <div>
                    <h3 style={{ marginBottom: 8 }}>{b.title}</h3>
                    <p style={{ margin: 0, fontSize: 15 }}>{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Preus */}
        <section style={{ padding: '80px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <Pricing />
          </div>
        </section>

        {/* CTA final */}
        <section style={{ textAlign: 'center', padding: '80px 24px 140px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <h2 style={{ marginBottom: 20 }}>
              Comença <em style={{ color: 'var(--gold)', fontWeight: 500 }}>avui</em>
            </h2>
            <p style={{ maxWidth: 460, margin: '0 auto 36px', fontSize: 17 }}>
              Registra el teu local en 2 minuts. Prova gratuïta de 14 dies. Sense compromís, cancel·la quan vulguis.
            </p>
            <Link href="/registra-bar" className="btn-slab">
              Registra el teu local
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
