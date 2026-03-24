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

      <main style={{
        background: 'linear-gradient(180deg, #6d0030 0%, #004d98 18%, #003570 32%, #4a0028 44%, #a50044 58%, #800038 72%, #1a0a20 86%, #0d1b2a 100%)',
      }}>
        {/* ── Com funciona ── */}
        <section id="com-funciona" style={{padding: '100px 24px 90px'}}>
          <div style={{maxWidth: 1100, margin: '0 auto'}}>
            <div style={{textAlign:'center', marginBottom:72}}>
              <span style={{display:'inline-block', fontSize:12, fontWeight:600, color:'#edbb00', letterSpacing:2, textTransform:'uppercase', marginBottom:16}}>Com funciona</span>
              <h2 style={{fontSize:'clamp(32px, 4vw, 48px)', color:'#fff', marginBottom:16, lineHeight:1.2}}>Tres passos i ja tens el teu bar</h2>
              <p style={{color:'rgba(255,255,255,0.6)', fontSize:17, maxWidth:420, margin:'0 auto'}}>Tan fàcil com obrir el mòbil</p>
            </div>

            <div className="step-grid" style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:24}}>
              {steps.map((s, i) => (
                <div key={i} style={{
                  padding:'40px 32px', textAlign:'center',
                  background: '#a50044', borderRadius: 20,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}>
                  {/* Step number */}
                  <div style={{
                    width:36, height:36, borderRadius:'50%',
                    background: '#edbb00',
                    display:'inline-flex', alignItems:'center', justifyContent:'center',
                    fontWeight:800, fontSize:14, color:'#1a1a2e',
                    marginBottom:20,
                    boxShadow: '0 4px 12px rgba(237,187,0,0.4)',
                  }}>{s.num}</div>

                  {/* Icon */}
                  <div style={{
                    width:72, height:72, borderRadius:20,
                    background: 'rgba(255,255,255,0.1)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    margin:'0 auto 24px',
                  }}>
                    {s.icon}
                  </div>

                  <h3 style={{fontSize:22, marginBottom:12, color:'#fff', fontWeight:700}}>{s.title}</h3>
                  <p style={{color:'rgba(255,255,255,0.7)', lineHeight:1.7, fontSize:15, margin:0}}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Característiques ── */}
        <section id="caracteristiques" style={{padding:'100px 24px'}}>
          <div style={{maxWidth: 1100, margin: '0 auto'}}>
            <div style={{textAlign:'center', marginBottom:72}}>
              <span style={{display:'inline-block', fontSize:12, fontWeight:600, color:'rgba(237,187,0,0.85)', letterSpacing:2, textTransform:'uppercase', marginBottom:16}}>Funcionalitats</span>
              <h2 style={{fontSize:'clamp(32px, 4vw, 48px)', color:'#fff', marginBottom:16, lineHeight:1.2}}>Per què troBar?</h2>
              <p style={{color:'rgba(255,255,255,0.6)', fontSize:17, maxWidth:460, margin:'0 auto'}}>Tot el que necessites per viure el Barça fora de casa</p>
            </div>
            <Features />
          </div>
        </section>

        {/* ── CTA per a bars ── */}
        <section style={{padding:'100px 24px 110px'}}>
          <div style={{maxWidth: 1100, margin: '0 auto', textAlign:'center'}}>
            <div style={{
              maxWidth:680, margin:'0 auto',
              background:'linear-gradient(135deg, #004d98 0%, #0d1b2a 50%, #a50044 100%)',
              borderRadius:28, padding:'64px 48px',
              color:'#fff',
              boxShadow:'0 12px 40px rgba(0,77,152,0.25)',
              position:'relative', overflow:'hidden',
            }}>
              {/* Decorative orbs */}
              <div style={{position:'absolute', top:'-30%', left:'-10%', width:250, height:250, borderRadius:'50%', background:'radial-gradient(circle, rgba(0,77,152,0.3), transparent 70%)', pointerEvents:'none'}} />
              <div style={{position:'absolute', bottom:'-20%', right:'-10%', width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle, rgba(165,0,68,0.3), transparent 70%)', pointerEvents:'none'}} />

              <div style={{position:'relative', zIndex:1}}>
                <span style={{
                  display:'inline-flex', alignItems:'center', gap:8,
                  background:'rgba(237,187,0,0.15)',
                  color:'#edbb00', fontWeight:600, padding:'8px 18px', borderRadius:999, fontSize:13,
                  marginBottom:28, border:'1px solid rgba(237,187,0,0.2)',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  Per a bars i restaurants
                </span>

                <h2 style={{fontSize:'clamp(28px, 4vw, 40px)', marginBottom:16, color:'#fff', lineHeight:1.2}}>Tens un bar on es veu el Barça?</h2>
                <p style={{color:'rgba(255,255,255,0.6)', fontSize:17, maxWidth:460, margin:'0 auto 36px', lineHeight:1.7}}>
                  Registra el teu local a troBar i converteix cada dia de partit en una oportunitat de negoci.
                </p>

                <Link href="/per-a-bars" style={{
                  display:'inline-block',
                  background:'linear-gradient(135deg, var(--gold), #ffd54f)',
                  color:'#1a1a2e', fontWeight:700, fontSize:16, padding:'16px 40px', borderRadius:14,
                  textDecoration:'none',
                  boxShadow:'0 4px 24px rgba(237,187,0,0.3)',
                  transition:'all 0.3s',
                }}>
                  Descobreix com
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
