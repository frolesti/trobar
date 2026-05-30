import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Hero from '../components/Hero'
import Features from '../components/Features'
import Footer from '../components/Footer'
import StoreBadges from '../components/StoreBadges'

export default function Home() {
  return (
    <>
      <Head>
        <title>troBar — Troba on veure el Barça</title>
        <meta name="description" content="El mapa col·laboratiu dels culers. Descobreix on emeten el Barça prop teu." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Header />
      <Hero />

      <main>

        {/* ══════════════════════════════════════════
            Secció 2 — Manifesto
            Centrada, gran, editorial. Com barpimentel.com
            fa servir text gros per explicar la seva identitat.
        ══════════════════════════════════════════ */}
        <section id="qui-som" style={{
          padding: '160px 24px',
          textAlign: 'center',
          background: 'var(--dark)',
        }}>
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <span className="eyebrow">Qui som</span>
            <h2 style={{ marginBottom: 36 }}>
              El bar de sempre<br />
              <em style={{ color: 'var(--gold)' }}>ara al teu mòbil</em>
            </h2>
            <p style={{
              fontSize: 19,
              lineHeight: 1.85,
              color: 'var(--cream-70)',
              maxWidth: 620,
              margin: '0 auto',
            }}>
              troBar és un mapa fet pels culers i per als culers. La comunitat
              marca on es veu cada partit, confirma horaris i valora l&apos;ambient.
              Tu tries on viure-ho.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            Secció 3 — Split: foto esquerra / text dreta
            Placeholder multimedia a l'esquerra.
        ══════════════════════════════════════════ */}
        <section id="app" style={{ background: 'var(--black)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            minHeight: '90vh',
          }} className="split-grid">

            {/* Esquerra — video glasses beer */}
            <div style={{ minHeight: 480, position: 'relative', background: 'var(--charcoal)' }}>
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              >
                <source src="/assets/videos/glasses-beer.mp4" type="video/mp4" />
              </video>
            </div>

            {/* Dreta — text */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '80px 64px',
            }}>
              <span className="eyebrow">L&apos;app</span>
              <h2 style={{ marginBottom: 32 }}>
                Busca, troba,<br />gaudeix
              </h2>
              <p style={{ fontSize: 17, marginBottom: 20 }}>
                Obre el mapa i veu al moment quins bars propers emeten el Barça avui.
                Filtra per zona, llegeix valoracions i escull el teu lloc.
              </p>
              <p style={{ fontSize: 17 }}>
                Cada barra del mapa ha estat afegida per un culer real. Sense
                directoris buits, sense informació desactualitzada.
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            Secció 4 — Split: text esquerra / foto dreta
        ══════════════════════════════════════════ */}
        <section id="comunitat" style={{ background: 'var(--dark)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            minHeight: '90vh',
          }} className="split-grid">

            {/* Esquerra — video */}
            <div style={{ minHeight: 480, position: 'relative', background: 'var(--charcoal)' }}>
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              >
                <source src="/assets/videos/community.mp4" type="video/mp4" />
              </video>
            </div>

            {/* Dreta — text */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '80px 64px',
            }}>
              <span className="eyebrow">Comunitat</span>
              <h2 style={{ marginBottom: 32 }}>
                La millor penya<br />
                <em style={{ color: 'var(--gold)' }}>ets tu</em>
              </h2>
              <p style={{ fontSize: 17, marginBottom: 20 }}>
                troBar creix gràcies als culers. Afegeix bars nous, confirma
                que emeten el pròxim partit i deixa la teva valoració perquè
                els altres sàpiguen quin ambient hi ha.
              </p>
              <p style={{ fontSize: 17 }}>
                Com més culers hi participen, millor és el mapa per a tothom.
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            Secció 5 — Com funciona (3 passos)
        ══════════════════════════════════════════ */}
        <section id="com-funciona" style={{
          padding: '140px 48px',
          background: 'var(--black)',
          borderTop: '1px solid var(--hairline)',
          borderBottom: '1px solid var(--hairline)',
        }}>
          <div style={{ maxWidth: 1160, margin: '0 auto' }}>
            <div style={{ marginBottom: 100 }}>
              <span className="eyebrow">Com funciona</span>
              <h2 style={{ maxWidth: 500 }}>
                Tres passos,<br />un bar
              </h2>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 0,
            }} className="step-grid">
              {[
                { n: '01', title: 'Obre l\'app',        desc: 'Descarrega troBar i permet que detecti la teva ubicació. En deu segons tens el mapa actiu.' },
                { n: '02', title: 'Busca al mapa',      desc: 'Veu tots els bars propers que emeten el Barça avui. Toca qualsevol punter per veure\'n els detalls.' },
                { n: '03', title: 'Gaudeix del partit', desc: 'Tria el bar que més t\'agradi i gaudeix del Barça com es mereix: envoltat de la millor afició.' },
              ].map((s, i) => (
                <div key={i} className="step-item" style={{
                  paddingRight: 48,
                  paddingLeft: i > 0 ? 48 : 0,
                  borderLeft: i > 0 ? '1px solid var(--hairline)' : 'none',
                }}>
                  <span className="step-num" style={{
                    display: 'block',
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(56px, 6vw, 96px)',
                    fontWeight: 900,
                    color: 'var(--gold)',
                    lineHeight: 0.9,
                    marginBottom: 32,
                    opacity: 0.6,
                  }}>
                    {s.n}
                  </span>
                  <h3 style={{ marginBottom: 16, fontSize: 20 }}>{s.title}</h3>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            Secció 6 — Característiques
        ══════════════════════════════════════════ */}
        <section id="caracteristiques" style={{ padding: '120px 48px', background: 'var(--dark)' }}>
          <div style={{ maxWidth: 1160, margin: '0 auto' }}>
            <div style={{ marginBottom: 80 }}>
              <span className="eyebrow">Per què troBar</span>
              <h2 style={{ maxWidth: 480 }}>
                Tot el que<br />necessites
              </h2>
            </div>
            <Features />
          </div>
        </section>

        {/* ══════════════════════════════════════════
            Secció 7 — Descàrrega CTA
            Estil barpimentel.com: text gran centrat + CTA senzill
        ══════════════════════════════════════════ */}
        <section id="descarrega" style={{
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '120px 24px',
          background: 'var(--black)',
          borderTop: '1px solid var(--hairline)',
        }}>
          <div>
            <span className="eyebrow">Descarrega</span>
            <h2 style={{ marginBottom: 40, maxWidth: 640, margin: '0 auto 40px' }}>
              Disponible a<br />
              <em style={{ color: 'var(--gold)' }}>iOS i Android</em>
            </h2>
            <StoreBadges center />
          </div>
        </section>

        {/* ══════════════════════════════════════════
            Secció 8 — Per a bars (full-bleed, dark)
        ══════════════════════════════════════════ */}
        <section id="per-a-bars" style={{
          position: 'relative',
          minHeight: '70vh',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          background: 'var(--dark)',
          borderTop: '1px solid var(--hairline)',
        }}>
          {/* Imatge de fons: bar fallout */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 0,
          }}>
            <img
              src="/assets/img/bar-fallout.jpg"
              alt="Ambient de bar"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: 'rgba(12,12,12,0.75)',
          }} />

          <div style={{
            position: 'relative', zIndex: 2,
            padding: '80px 64px',
            maxWidth: 680,
          }}>
            <span className="eyebrow">Per a bars i restaurants</span>
            <h2 style={{ marginBottom: 28 }}>
              Tens un bar on<br />
              <em style={{ color: 'var(--gold)' }}>es veu el Barça</em>?
            </h2>
            <p style={{ fontSize: 17, marginBottom: 40, maxWidth: 480 }}>
              Apareix al mapa que fan servir milers de culers cada dia de
              partit. Registra el teu local i converteix l&apos;afició en clients fidels.
            </p>
            <Link href="/per-a-bars" className="btn">
              Descobreix com
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </>
  )
}
