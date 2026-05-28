import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Hero from '../components/Hero'
import Features from '../components/Features'
import Footer from '../components/Footer'

export default function Home() {
  const steps = [
    { num: '01', title: 'Obre l\'app',         desc: 'Descarrega troBar i obre el mapa. Detecta la teva ubicació automàticament.' },
    { num: '02', title: 'Busca al mapa',       desc: 'Explora els bars propers que retransmeten el partit d\'avui amb un sol toc.' },
    { num: '03', title: 'Gaudeix del partit',  desc: 'Tria el bar que més t\'agradi, consulta horaris i viu el Barça amb el millor ambient.' },
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
        <section id="com-funciona" style={{ padding: '120px 24px 100px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 80 }}>
              <span className="eyebrow">Com funciona</span>
              <h2 style={{ marginBottom: 16 }}>
                Tres passos i ja tens <em style={{ color: 'var(--gold)', fontWeight: 500 }}>el teu bar</em>
              </h2>
              <p style={{ maxWidth: 460, margin: '0 auto', fontSize: 17 }}>
                Tan fàcil com obrir el mòbil.
              </p>
            </div>

            <div className="step-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 0,
            }}>
              {steps.map((s, i) => (
                <div key={i} style={{
                  padding: '0 32px',
                  borderLeft: i > 0 ? '1px solid var(--hairline)' : 'none',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-ui)', fontWeight: 500,
                    fontSize: 56, lineHeight: 1, color: 'var(--gold)',
                    display: 'block', marginBottom: 24,
                  }}>{s.num}</span>
                  <h3 style={{ marginBottom: 12 }}>{s.title}</h3>
                  <p style={{ margin: 0, fontSize: 16 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Característiques ── */}
        <section id="caracteristiques" style={{ padding: '80px 24px 100px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <span className="eyebrow">Característiques</span>
              <h2 style={{ marginBottom: 16 }}>
                Per què <em style={{ color: 'var(--gold)', fontWeight: 500 }}>troBar</em>?
              </h2>
              <p style={{ maxWidth: 460, margin: '0 auto', fontSize: 17 }}>
                Tot el que necessites per viure el Barça fora de casa.
              </p>
            </div>
            <Features />
          </div>
        </section>

        {/* ── CTA per a bars ── */}
        <section style={{ padding: '100px 24px 140px', textAlign: 'center' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <span className="eyebrow">Per a bars i restaurants</span>
            <h2 style={{ marginBottom: 20 }}>
              Tens un bar on <em style={{ color: 'var(--gold)', fontWeight: 500 }}>es veu el Barça</em>?
            </h2>
            <p style={{ maxWidth: 500, margin: '0 auto 36px', fontSize: 17 }}>
              Registra el teu local a troBar i converteix cada dia de partit en una oportunitat de negoci.
            </p>
            <Link href="/per-a-bars" className="btn-slab">
              Descobreix com
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
