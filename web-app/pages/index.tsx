import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Hero from '../components/Hero'
import Features from '../components/Features'
import Footer from '../components/Footer'

export default function Home() {
  const steps = [
    {
      num: '1',
      title: 'Obre l\'app',
      desc: 'Descarrega troBar i obre el mapa. Detecta la teva ubicació automàticament.',
      color: '#a50044',
      bg: 'rgba(165,0,68,0.12)',
      icon: (
        <svg width="40" height="40" viewBox="0 0 48 48">
          <defs><linearGradient id="pin3d" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff2d6f"/><stop offset="100%" stopColor="#a50044"/></linearGradient></defs>
          <path d="M24 2C15.16 2 8 9.16 8 18c0 12 16 28 16 28s16-16 16-28C40 9.16 32.84 2 24 2z" fill="url(#pin3d)" opacity="0.9"/>
          <circle cx="24" cy="18" r="6" fill="#fff" opacity="0.9"/>
          <circle cx="24" cy="18" r="3" fill="url(#pin3d)" opacity="0.6"/>
        </svg>
      ),
    },
    {
      num: '2',
      title: 'Busca al mapa',
      desc: 'Explora els bars propers que retransmeten el partit d\'avui amb un sol toc.',
      color: '#004d98',
      bg: 'rgba(0,77,152,0.12)',
      icon: (
        <svg width="40" height="40" viewBox="0 0 48 48">
          <defs><linearGradient id="map3d" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3da5ff"/><stop offset="100%" stopColor="#004d98"/></linearGradient></defs>
          <path d="M6 10l12-6 12 6 12-6v32l-12 6-12-6-12 6V10z" fill="url(#map3d)" opacity="0.85"/>
          <path d="M18 4v32" stroke="#fff" strokeWidth="1.5" opacity="0.4"/>
          <path d="M30 10v32" stroke="#fff" strokeWidth="1.5" opacity="0.4"/>
          <circle cx="24" cy="22" r="4" fill="#fff" opacity="0.9"/>
        </svg>
      ),
    },
    {
      num: '3',
      title: 'Gaudeix del partit',
      desc: 'Tria el bar que més t\'agradi, consulta horaris i viu el Barça amb la millor ambient.',
      color: '#edbb00',
      bg: 'rgba(237,187,0,0.14)',
      icon: (
        <svg width="40" height="40" viewBox="0 0 48 48">
          <defs><linearGradient id="play3d" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffd54f"/><stop offset="100%" stopColor="#edbb00"/></linearGradient></defs>
          <circle cx="24" cy="24" r="20" fill="url(#play3d)" opacity="0.9"/>
          <polygon points="20,14 34,24 20,34" fill="#1a1a2e" opacity="0.85"/>
        </svg>
      ),
    },
  ]

  return (
    <>
      <Head>
        <title>troBar — Troba on veure el Barça</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />
      <Hero />

      <main>
        {/* ── Com funciona ── */}
        <section id="com-funciona" className="section-blau" style={{padding: '100px 24px 90px'}}>
          <div style={{maxWidth: 1100, margin: '0 auto'}}>
            <div style={{textAlign:'center', marginBottom:72}}>
              <span style={{display:'inline-block', fontSize:12, fontWeight:600, color:'var(--blue)', letterSpacing:2, textTransform:'uppercase', marginBottom:16}}>Com funciona</span>
              <h2 style={{fontSize:'clamp(32px, 4vw, 48px)', color:'var(--text)', marginBottom:16, lineHeight:1.2}}>Tres passos i ja tens el teu bar</h2>
              <p style={{color:'var(--muted)', fontSize:17, maxWidth:420, margin:'0 auto'}}>Tan fàcil com obrir el mòbil</p>
            </div>

            <div className="step-grid" style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:24}}>
              {steps.map((s, i) => (
                <div key={i} className="glow-card" style={{padding:'40px 32px', textAlign:'center'}}>
                  {/* Step number */}
                  <div style={{
                    width:32, height:32, borderRadius:'50%',
                    background: s.color,
                    display:'inline-flex', alignItems:'center', justifyContent:'center',
                    fontWeight:800, fontSize:13, color:'#fff',
                    marginBottom:20,
                  }}>{s.num}</div>

                  {/* Icon */}
                  <div style={{
                    width:72, height:72, borderRadius:20,
                    background: s.bg,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    margin:'0 auto 24px',
                    border:'1px solid var(--border)',
                  }}>
                    {s.icon}
                  </div>

                  <h3 style={{fontSize:22, marginBottom:12, color:'var(--text)', fontWeight:700}}>{s.title}</h3>
                  <p style={{color:'var(--muted)', lineHeight:1.7, fontSize:15, margin:0}}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Característiques ── */}
        <section id="caracteristiques" className="section-grana-radial" style={{padding:'100px 24px'}}>
          <div style={{maxWidth: 1100, margin: '0 auto'}}>
            <div style={{textAlign:'center', marginBottom:72}}>
              <span style={{display:'inline-block', fontSize:12, fontWeight:600, color:'var(--accent)', letterSpacing:2, textTransform:'uppercase', marginBottom:16}}>Funcionalitats</span>
              <h2 style={{fontSize:'clamp(32px, 4vw, 48px)', color:'var(--text)', marginBottom:16, lineHeight:1.2}}>Per què troBar?</h2>
              <p style={{color:'var(--muted)', fontSize:17, maxWidth:460, margin:'0 auto'}}>Tot el que necessites per viure el Barça fora de casa</p>
            </div>
            <Features />
          </div>
        </section>

        {/* ── CTA per a bars ── */}
        <section className="section-blau-radial" style={{padding:'100px 24px 110px'}}>
          <div style={{maxWidth: 1100, margin: '0 auto', textAlign:'center'}}>
            <div style={{
              maxWidth:680, margin:'0 auto',
              background:'var(--card)',
              borderRadius:28, padding:'64px 48px',
              border:'1px solid var(--border)',              borderTop:'4px solid #a50044',              boxShadow:'var(--shadow-lg)',
            }}>
              <span style={{
                display:'inline-flex', alignItems:'center', gap:8,
                background:'rgba(237,187,0,0.15)',
                color:'#9a7700', fontWeight:600, padding:'8px 18px', borderRadius:999, fontSize:13,
                marginBottom:28, border:'1px solid rgba(237,187,0,0.25)',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                Per a bars i restaurants
              </span>

              <h2 style={{fontSize:'clamp(28px, 4vw, 40px)', marginBottom:16, color:'var(--text)', lineHeight:1.2}}>Tens un bar on es veu el Barça?</h2>
              <p style={{color:'var(--muted)', fontSize:17, maxWidth:460, margin:'0 auto 36px', lineHeight:1.7}}>
                Registra el teu local a troBar i converteix cada dia de partit en una oportunitat de negoci.
              </p>

              <Link href="/per-a-bars" style={{
                display:'inline-block',
                background:'linear-gradient(135deg, var(--accent), var(--accent-light))',
                color:'#fff', fontWeight:700, fontSize:16, padding:'16px 40px', borderRadius:14,
                textDecoration:'none',
                boxShadow:'0 4px 24px rgba(165,0,68,0.2)',
                transition:'all 0.3s',
              }}>
                Descobreix com
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
