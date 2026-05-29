import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Pricing from '../components/Pricing'
import Footer from '../components/Footer'
import FloatingLogos from '../components/FloatingLogos'

export default function PerABars() {
  const benefits = [
    { icon: 'map', title: 'Visibilitat al mapa',
      desc: 'El teu bar apareix destacat quan milers de culers busquen on veure el partit.' },
    { icon: 'shield', title: 'Perfil verificat',
      desc: 'Insígnia verificada amb fotos, horaris reals i equipament confirmat.' },
    { icon: 'megaphone', title: 'Anuncia partits',
      desc: 'Confirma quins partits emets i els culers propers ho veuran al moment.' },
    { icon: 'gallery', title: 'Galeria i equipament',
      desc: 'Publica fins a 10 fotos del local i destaca pantalles, projector i terrassa.' },
  ]

  const BenefitIcon = ({ kind }: { kind: string }) => {
    const base = {
      width: 52,
      height: 52,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'var(--gold)',
      strokeWidth: 1.9,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      'aria-hidden': true,
    }

    if (kind === 'map') {
      return (
        <svg {...base}>
          <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      )
    }

    if (kind === 'shield') {
      return (
        <svg {...base}>
          <path d="M12 3l7 3v5c0 5-3.4 8.4-7 10-3.6-1.6-7-5-7-10V6l7-3Z" />
          <path d="m9.5 12 1.8 1.9L14.8 10" />
        </svg>
      )
    }

    if (kind === 'megaphone') {
      return (
        <svg {...base}>
          <path d="M3 11v2a2 2 0 0 0 2 2h2l2 5h2l-1.5-5H13l7-3V8l-7-3H5a2 2 0 0 0-2 2v4Z" />
        </svg>
      )
    }

    return (
      <svg {...base}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.5" />
        <path d="m21 16-5-4-3 3-2-2-4 3" />
      </svg>
    )
  }

  return (
    <>
      <Head>
        <title>troBar — Per a Bars i Restaurants</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Registra el teu bar a troBar i atrau milers d'aficionats del Barça cada dia de partit." />
      </Head>
      <Header />

      <main style={{ position: 'relative', overflow: 'hidden' }}>
        <FloatingLogos count={12} opacity={0.32} fixed zIndex={0} />
        <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Hero per a bars */}
        <section style={{ padding: '160px 24px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', zIndex: 1 }} className="fade-up">
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
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 999,
                    border: '1px solid var(--hairline)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}>
                    <BenefitIcon kind={b.icon} />
                  </div>
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
        </div>
      </main>

      <Footer />
    </>
  )
}
