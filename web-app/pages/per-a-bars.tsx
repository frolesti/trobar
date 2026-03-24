import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Pricing from '../components/Pricing'
import Footer from '../components/Footer'

export default function PerABars() {
  const benefits = [
    {
      title: 'Visibilitat al mapa',
      desc: 'El teu bar apareix destacat quan milers de culers busquen on veure el partit. Arribes al client exacte, en el moment exacte.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      )
    },
    {
      title: 'Perfil verificat',
      desc: 'Mostra la insígnia de local verificat amb fotos, horaris reals i equipament confirmat. Genera confiança des del primer moment.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      )
    },
    {
      title: 'Anuncia partits',
      desc: 'Confirma quins partits emets i els culers propers ho veuran al moment. Converteix cada jornada en una oportunitat.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
      )
    },
    {
      title: 'Galeria i equipament',
      desc: 'Publica fins a 10 fotos del local i destaca les teves pantalles, projector, terrassa i més equipament.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      )
    }
  ]

  return (
    <>
      <Head>
        <title>troBar — Per a Bars i Restaurants</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Registra el teu bar a troBar i atrau milers d'aficionats del Barça cada dia de partit." />
      </Head>
      <Header />

      {/* Hero per a bars */}
      <section style={{
        background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-light) 100%)',
        padding: '160px 24px 80px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <span style={{
            display: 'inline-block',
            background: 'var(--gold)',
            color: 'var(--text)',
            fontWeight: 700,
            padding: '8px 20px',
            borderRadius: 999,
            fontSize: 15,
            marginBottom: 24
          }}>
            Per a bars i restaurants
          </span>
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 60px)',
            fontWeight: 800,
            color: '#fff',
            marginBottom: 20,
            lineHeight: 1.08
          }}>
            Converteix cada partit en clients
          </h1>
          <p style={{
            fontSize: 20,
            color: 'rgba(255,255,255,0.75)',
            maxWidth: 540,
            margin: '0 auto 40px',
            lineHeight: 1.65
          }}>
            Milers de culers busquen on veure el Barça prop seu. Apareix al seu mapa amb un perfil verificat i omple el local cada jornada.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/registra-bar" style={{
              background: 'var(--gold)',
              color: 'var(--text)',
              fontWeight: 700,
              fontSize: 18,
              padding: '16px 36px',
              borderRadius: 999,
              textDecoration: 'none',
              boxShadow: '0 10px 26px rgba(237,187,0,0.2)',
              transition: 'transform 0.2s'
            }}>
              Registra el teu local
            </Link>
            <a href="#preus" style={{
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 18,
              padding: '16px 36px',
              borderRadius: 999,
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.2)',
              transition: 'transform 0.2s'
            }}>
              Veure plans
            </a>
          </div>
        </div>
      </section>

      <main>
        {/* Beneficis */}
        <section className="section-blau" style={{ padding: '80px 24px 64px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h2 style={{ fontSize: 36, color: '#fff', textAlign: 'center', marginBottom: 12 }}>Què inclou troBar?</h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', textAlign: 'center', fontSize: 18, maxWidth: 480, margin: '0 auto 48px' }}>
            Tot el que necessites per atraure culers i fer créixer el teu negoci.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {benefits.map((b, i) => (
              <div key={i} style={{
                background: 'var(--card)',
                borderRadius: 20,
                padding: '32px 28px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left'
              }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: 'rgba(237,187,0,0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20
                }}>
                  {b.icon}
                </div>
                <h3 style={{ fontSize: 20, marginBottom: 10, color: 'var(--text)', fontWeight: 700 }}>{b.title}</h3>
                <p style={{ color: 'var(--muted)', lineHeight: 1.65, fontSize: 15, margin: 0 }}>{b.desc}</p>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* Preus */}
        <section className="section-grana-radial" style={{ padding: '80px 24px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <Pricing />
          </div>
        </section>

        {/* CTA final */}
        <section className="section-blau-radial" style={{ textAlign: 'center', padding: '64px 24px 80px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, color: '#fff', marginBottom: 16 }}>Comença avui</h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 18, maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Registra el teu local en 2 minuts. Prova gratuïta de 14 dies.<br/>Sense compromís, cancel·la quan vulguis.
          </p>
          <Link href="/registra-bar" style={{
            display: 'inline-block',
            background: 'var(--gold)',
            color: 'var(--text)',
            fontWeight: 700,
            fontSize: 18,
            padding: '16px 40px',
            borderRadius: 999,
            textDecoration: 'none',
            boxShadow: '0 10px 26px rgba(237,187,0,0.2)'
          }}>
            Registra el teu local
          </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
