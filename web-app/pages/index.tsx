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
      title: 'Obre el mapa',
      desc: 'troBar detecta la teva ubicació i et mostra els bars més propers que emeten partits del Barça.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      )
    },
    {
      num: '2',
      title: 'Tria el teu bar',
      desc: 'Consulta perfils verificats amb fotos, pantalles, terrassa, horaris i distància. Filtra per equipament.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      )
    },
    {
      num: '3',
      title: 'Gaudeix del partit',
      desc: 'Ves al bar, viu l\'ambient culer i no et perdis cap gol. Així de fàcil.',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
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
        <section id="com-funciona" className="section-blau" style={{padding: '80px 24px 72px'}}>
          <div style={{maxWidth: 1200, margin: '0 auto'}}>
          <h2 style={{fontSize: 36, marginBottom: 12, color: '#fff', textAlign: 'center'}}>Com funciona</h2>
          <p style={{color: 'rgba(255,255,255,0.65)', fontSize: 18, maxWidth: 480, margin: '0 auto 56px', textAlign: 'center'}}>Tres passos i ja tens el teu bar ideal</p>

          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 28}}>
            {steps.map((s, i) => (
              <div key={i} style={{background: 'var(--card)', borderRadius: 20, padding: '40px 28px 36px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', position: 'relative', transition: 'transform 0.2s'}}>
                <div style={{position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: 'var(--text)', boxShadow: '0 4px 12px rgba(237,187,0,0.3)'}}>{s.num}</div>
                <div style={{width: 64, height: 64, borderRadius: 16, background: 'rgba(0,77,152,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px auto 20px'}}>
                  {s.icon}
                </div>
                <h3 style={{fontSize: 22, marginBottom: 10, color: 'var(--text)', fontWeight: 700}}>{s.title}</h3>
                <p style={{color: 'var(--muted)', lineHeight: 1.65, fontSize: 15, margin: 0}}>{s.desc}</p>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* Característiques */}
        <section id="caracteristiques" className="section-grana-radial" style={{padding: '72px 24px'}}>
          <div style={{maxWidth: 1200, margin: '0 auto'}}>
          <h2 style={{fontSize: 36, marginBottom: 12, color: '#fff', textAlign: 'center'}}>Per què troBar?</h2>
          <p style={{color: 'rgba(255,255,255,0.65)', fontSize: 18, maxWidth: 480, margin: '0 auto 48px', textAlign: 'center'}}>Tot el que necessites per viure el Barça fora de casa</p>
            <Features />
          </div>
        </section>

        {/* CTA per a bars */}
        <section className="section-blau-radial" style={{textAlign: 'center', padding: '72px 24px 80px'}}>
          <div style={{maxWidth: 1200, margin: '0 auto'}}>
          <div style={{background: 'var(--card)', borderRadius: 24, padding: '56px 40px', maxWidth: 680, margin: '0 auto', boxShadow: '0 16px 48px rgba(0,0,0,0.12)'}}>
            <span style={{display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--gold)', color: 'var(--text)', fontWeight: 700, padding: '8px 18px', borderRadius: 999, fontSize: 14, marginBottom: 24}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              Per a bars i restaurants
            </span>
            <h2 style={{fontSize: 32, marginBottom: 14, color: 'var(--text)'}}>Tens un bar on es veu el Barça?</h2>
            <p style={{color: 'var(--muted)', fontSize: 17, maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.65}}>Registra el teu local a troBar i converteix cada dia de partit en una oportunitat de negoci. Més visibilitat, més clients.</p>
            <Link href="/per-a-bars" style={{display: 'inline-block', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 17, padding: '16px 40px', borderRadius: 999, textDecoration: 'none', boxShadow: '0 8px 24px rgba(165,0,68,0.18)', transition: 'transform 0.2s'}}>
              Descobreix els plans
            </Link>
          </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
