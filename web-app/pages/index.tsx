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
      title: 'Obre l\u2019app',
      desc: 'Descarrega troBar i obre el mapa. Detecta la teva ubicació automàticament.',
      icon: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
      )
    },
    {
      num: '2',
      title: 'Busca al mapa',
      desc: 'Explora els bars propers que retransmeten el partit d\u2019avui amb un sol toc.',
      icon: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
      )
    },
    {
      num: '3',
      title: 'Gaudeix del partit',
      desc: 'Tria el bar que més t\u2019agradi, consulta horaris i viu el Barça amb la millor ambient.',
      icon: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
      )
    }
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
        {/* Com funciona — 3 passos visuals */}
        <section id="com-funciona" className="section-blau" style={{padding: '80px 24px 64px'}}>
          <div style={{maxWidth: 1200, margin: '0 auto'}}>
          <h2 style={{fontSize: 36, marginBottom: 12, color: '#fff', textAlign: 'center'}}>Com funciona</h2>
          <p style={{color: 'rgba(255,255,255,0.7)', fontSize: 18, maxWidth: 540, margin: '0 auto 48px', textAlign: 'center'}}>En tres passos tens el teu bar ideal per veure el Barça</p>

          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 32}}>
            {steps.map((s, i) => (
              <div key={i} style={{background: 'var(--card)', borderRadius: 20, padding: '36px 28px', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.10)', position: 'relative'}}>
                <div style={{width: 72, height: 72, borderRadius: '50%', background: 'rgba(0,77,152,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'}}>
                  {s.icon}
                </div>
                <div style={{position: 'absolute', top: 16, left: 20, width: 28, height: 28, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: 'var(--text)'}}>{s.num}</div>
                <h3 style={{fontSize: 22, marginBottom: 10, color: 'var(--text)'}}>{s.title}</h3>
                <p style={{color: 'var(--muted)', lineHeight: 1.6, fontSize: 15}}>{s.desc}</p>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* Característiques */}
        <section id="caracteristiques" className="section-grana-radial" style={{padding: '64px 24px'}}>
          <div style={{maxWidth: 1200, margin: '0 auto'}}>
          <h2 style={{fontSize: 36, marginBottom: 12, color: '#fff', textAlign: 'center'}}>Característiques</h2>
          <p style={{color: 'rgba(255,255,255,0.7)', fontSize: 18, maxWidth: 540, margin: '0 auto 48px', textAlign: 'center'}}>Funcionalitats bàsiques de l'aplicació</p>
            <Features />
          </div>
        </section>

        {/* CTA per a bars */}
        <section className="section-blau-radial" style={{textAlign: 'center', padding: '64px 24px 80px'}}>
          <div style={{maxWidth: 1200, margin: '0 auto'}}>
          <div style={{background: 'var(--card)', borderRadius: 24, padding: '56px 40px', maxWidth: 680, margin: '0 auto', boxShadow: '0 12px 32px rgba(0,0,0,0.10)'}}>
            <span style={{display: 'inline-block', background: 'var(--gold)', color: 'var(--text)', fontWeight: 700, padding: '6px 16px', borderRadius: 999, fontSize: 14, marginBottom: 20}}>Per a bars i restaurants</span>
            <h2 style={{fontSize: 32, marginBottom: 14, color: 'var(--text)'}}>Tens un bar on es veu el Barça?</h2>
            <p style={{color: 'var(--muted)', fontSize: 17, maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.6}}>Registra el teu local a troBar i atrau milers d&apos;aficionats cada dia de partit. Consulta els nostres plans i comença a créixer.</p>
            <Link href="/per-a-bars" style={{display: 'inline-block', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 17, padding: '14px 36px', borderRadius: 999, textDecoration: 'none', boxShadow: '0 8px 20px rgba(165,0,68,0.15)', transition: 'transform 0.2s'}}>
              Descobreix com →
            </Link>
          </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
