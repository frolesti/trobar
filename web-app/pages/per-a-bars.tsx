import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Pricing from '../components/Pricing'
import Footer from '../components/Footer'

export default function PerABars() {
  const benefits = [
    {
      title: 'Visibilitat instantània',
      desc: 'Milers de culers busquen on veure el partit. El teu bar apareix al mapa quan més et necessiten.',
      icon: (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      )
    },
    {
      title: 'Perfil verificat',
      desc: 'Mostra la insígnia de local verificat. Genera confiança i destaca per sobre de la competència.',
      icon: (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      )
    },
    {
      title: 'Promocions i ofertes',
      desc: 'Publica ofertes especials per als dies de partit i atrau clients directament des de l\'app.',
      icon: (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      )
    },
    {
      title: 'Estadístiques reals',
      desc: 'Coneix quants usuaris veuen el teu perfil, truquen o demanen indicacions cada setmana.',
      icon: (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
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
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 800,
            color: '#fff',
            marginBottom: 20,
            lineHeight: 1.05
          }}>
            Omple el teu local cada dia de partit
          </h1>
          <p style={{
            fontSize: 20,
            color: 'rgba(255,255,255,0.75)',
            maxWidth: 560,
            margin: '0 auto 40px',
            lineHeight: 1.6
          }}>
            Milers de culers busquen on veure el Barça. Posa el teu bar al mapa i converteix cada partit en una oportunitat de negoci.
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
          <h2 style={{ fontSize: 36, color: '#fff', textAlign: 'center', marginBottom: 12 }}>Per què troBar?</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontSize: 18, maxWidth: 540, margin: '0 auto 48px' }}>
            Tot el que necessites per atraure aficionats i fer créixer el teu negoci.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 28 }}>
            {benefits.map((b, i) => (
              <div key={i} style={{
                background: 'var(--card)',
                borderRadius: 20,
                padding: '32px 24px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(237,187,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20
                }}>
                  {b.icon}
                </div>
                <h3 style={{ fontSize: 20, marginBottom: 10, color: 'var(--text)' }}>{b.title}</h3>
                <p style={{ color: 'var(--muted)', lineHeight: 1.6, fontSize: 15 }}>{b.desc}</p>
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
          <h2 style={{ fontSize: 32, color: '#fff', marginBottom: 16 }}>Preparat per començar?</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, maxWidth: 480, margin: '0 auto 32px' }}>
            Registra el teu bar en menys de 2 minuts i comença a rebre culers.
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
