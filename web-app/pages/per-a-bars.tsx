import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Pricing from '../components/Pricing'
import Footer from '../components/Footer'

export default function PerABars() {
  const benefits = [
    {
      title: 'Visibilitat al mapa',
      desc: 'El teu bar apareix destacat quan milers de culers busquen on veure el partit.',
      accent: 'var(--gold)',
      bg: 'rgba(237,187,0,0.14)',
      borderColor: '#edbb00',
      icon: (
        <svg width="34" height="34" viewBox="0 0 48 48">
          <defs><linearGradient id="bPin" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffd54f"/><stop offset="100%" stopColor="#edbb00"/></linearGradient></defs>
          <path d="M24 2C15.16 2 8 9.16 8 18c0 12 16 28 16 28s16-16 16-28C40 9.16 32.84 2 24 2z" fill="url(#bPin)" opacity="0.9"/>
          <circle cx="24" cy="18" r="5" fill="#1a1a2e" opacity="0.7"/>
        </svg>
      ),
    },
    {
      title: 'Perfil verificat',
      desc: 'Insígnia verificada amb fotos, horaris reals i equipament confirmat.',
      accent: 'var(--blue-light)',
      bg: 'rgba(0,77,152,0.14)',
      borderColor: '#004d98',
      icon: (
        <svg width="34" height="34" viewBox="0 0 48 48">
          <defs><linearGradient id="bCheck" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3da5ff"/><stop offset="100%" stopColor="#004d98"/></linearGradient></defs>
          <circle cx="24" cy="24" r="20" fill="url(#bCheck)" opacity="0.9"/>
          <polyline points="15,24 22,31 34,17" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      title: 'Anuncia partits',
      desc: 'Confirma quins partits emets i els culers propers ho veuran al moment.',
      accent: 'var(--accent-light)',
      bg: 'rgba(165,0,68,0.14)',
      borderColor: '#a50044',
      icon: (
        <svg width="34" height="34" viewBox="0 0 48 48">
          <defs><linearGradient id="bTv" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff4081"/><stop offset="100%" stopColor="#a50044"/></linearGradient></defs>
          <rect x="4" y="10" width="40" height="28" rx="5" fill="url(#bTv)" opacity="0.9"/>
          <rect x="8" y="14" width="32" height="20" rx="3" fill="#1a1a2e" opacity="0.4"/>
          <polygon points="20,19 32,24 20,29" fill="#fff" opacity="0.8"/>
        </svg>
      ),
    },
    {
      title: 'Galeria i equipament',
      desc: 'Publica fins a 10 fotos del local i destaca pantalles, projector i terrassa.',
      accent: 'var(--gold)',
      bg: 'rgba(237,187,0,0.14)',
      borderColor: '#edbb00',
      icon: (
        <svg width="34" height="34" viewBox="0 0 48 48">
          <defs><linearGradient id="bImg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffd54f"/><stop offset="100%" stopColor="#edbb00"/></linearGradient></defs>
          <rect x="4" y="6" width="40" height="36" rx="6" fill="url(#bImg)" opacity="0.9"/>
          <circle cx="16" cy="18" r="5" fill="#1a1a2e" opacity="0.4"/>
          <path d="M4 34l12-12 8 8 6-6 14 12" fill="#1a1a2e" opacity="0.3"/>
        </svg>
      ),
    },
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
        background: 'linear-gradient(135deg, #004d98 0%, #0d1b2a 50%, #a50044 100%)',
        padding: '160px 24px 100px',
        textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient blobs */}
        <div style={{position:'absolute', top:'10%', left:'15%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(165,0,68,0.18), transparent 70%)', pointerEvents:'none'}} />
        <div style={{position:'absolute', bottom:'10%', right:'10%', width:350, height:350, borderRadius:'50%', background:'radial-gradient(circle, rgba(0,77,152,0.15), transparent 70%)', pointerEvents:'none'}} />

        <div style={{ maxWidth: 720, margin: '0 auto', position:'relative', zIndex:1 }}>
          <span style={{
            display: 'inline-flex', alignItems:'center', gap:8,
            background: 'linear-gradient(135deg, rgba(237,187,0,0.15), rgba(237,187,0,0.05))',
            color: 'var(--gold)',
            fontWeight: 600,
            padding: '8px 20px',
            borderRadius: 999,
            fontSize: 13,
            marginBottom: 28,
            border: '1px solid rgba(237,187,0,0.15)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Per a bars i restaurants
          </span>
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 60px)',
            fontWeight: 800,
            color: '#fff',
            marginBottom: 20,
            lineHeight: 1.08,
          }}>
            Converteix cada partit{' '}
            <span style={{
              background: 'linear-gradient(90deg, var(--gold), #ffd54f)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>en clients</span>
          </h1>
          <p style={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.5)',
            maxWidth: 520,
            margin: '0 auto 40px',
            lineHeight: 1.7,
          }}>
            Milers de culers busquen on veure el Barça prop seu. Apareix al seu mapa amb un perfil verificat i omple el local cada jornada.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/registra-bar" style={{
              background: 'linear-gradient(135deg, var(--gold), #ffd54f)',
              color: '#1a1a2e',
              fontWeight: 700,
              fontSize: 16,
              padding: '16px 36px',
              borderRadius: 14,
              textDecoration: 'none',
              boxShadow: '0 4px 24px rgba(237,187,0,0.25)',
              transition: 'transform 0.2s',
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              Registra el teu local
            </Link>
            <a href="#preus" style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 16,
              padding: '16px 36px',
              borderRadius: 14,
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.1)',
              transition: 'all 0.3s',
            }}>
              Veure plans
            </a>
          </div>
        </div>
      </section>

      <main>
        {/* Beneficis */}
        <section className="section-blau" style={{ padding: '100px 24px 80px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{textAlign:'center', marginBottom:64}}>
              <span style={{display:'inline-block', fontSize:12, fontWeight:600, color:'rgba(237,187,0,0.85)', letterSpacing:2, textTransform:'uppercase', marginBottom:16}}>Què inclou</span>
              <h2 style={{ fontSize: 'clamp(32px, 4vw, 44px)', color: '#fff', marginBottom: 14 }}>Tot per fer créixer el teu negoci</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17, maxWidth: 460, margin: '0 auto' }}>
                Eines pensades perquè cada dia de partit sigui una oportunitat.
              </p>
            </div>

            <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
              {benefits.map((b, i) => (
                <div key={i} className="glow-card" style={{
                  padding: '36px 30px',
                  display: 'flex', gap: 20, alignItems: 'flex-start',
                  borderTop: `4px solid ${b.borderColor}`,
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                    background: b.borderColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 4px 12px ${b.borderColor}40`,
                  }}>
                    {b.icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 19, marginBottom: 8, color: 'var(--text)', fontWeight: 700 }}>{b.title}</h3>
                    <p style={{ color: 'var(--muted)', lineHeight: 1.65, fontSize: 15, margin: 0 }}>{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Preus */}
        <section className="section-light" style={{ padding: '100px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <Pricing />
          </div>
        </section>

        {/* CTA final */}
        <section className="section-grana" style={{ textAlign: 'center', padding: '100px 24px 110px', position:'relative' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', position:'relative', zIndex:1 }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', color: '#fff', marginBottom: 16 }}>Comença avui</h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 17, maxWidth: 460, margin: '0 auto 36px', lineHeight: 1.7 }}>
              Registra el teu local en 2 minuts. Prova gratuïta de 14 dies.<br/>Sense compromís, cancel·la quan vulguis.
            </p>
            <Link href="/registra-bar" style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, var(--gold), #ffd54f)',
              color: '#1a1a2e',
              fontWeight: 700,
              fontSize: 16,
              padding: '16px 40px',
              borderRadius: 14,
              textDecoration: 'none',
              boxShadow: '0 4px 24px rgba(237,187,0,0.3)',
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
