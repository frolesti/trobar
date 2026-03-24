import Head from 'next/head'
import Header from '../components/Header'
import dynamic from 'next/dynamic'
import Footer from '../components/Footer'
import LegalModal from '../components/LegalModal'
import { useState } from 'react'

// Lazy-load ContactForm client-side only so Firebase doesn't init during SSG build
const ContactForm = dynamic(() => import('../components/ContactForm'), { ssr: false })

type LegalType = 'privacy' | 'terms'

export default function RegisterBar() {
  const [legalOpen, setLegalOpen] = useState<LegalType | null>(null)

  return (
    <>
      <Head>
        <title>troBar — Registra el teu local</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />

      {/* Hero — same style as per-a-bars */}
      <section style={{
        background: 'linear-gradient(135deg, #004d98 0%, #0d1b2a 50%, #a50044 100%)',
        padding: 'clamp(120px, 15vw, 160px) 24px clamp(50px, 8vw, 80px)',
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
            Per a bars i restaurants
          </span>
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 60px)',
            fontWeight: 800,
            color: '#fff',
            marginBottom: 20,
            lineHeight: 1.08,
          }}>
            Fes créixer el teu{' '}
            <span style={{
              background: 'linear-gradient(90deg, var(--gold), #ffd54f)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>negoci</span>
          </h1>
          <p style={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.5)',
            maxWidth: 520,
            margin: '0 auto',
            lineHeight: 1.7,
          }}>
            Crea el teu compte ara i comença a atraure centenars de culers cada dia de partit.
          </p>
        </div>
      </section>

      {/* Main content — gradient matching per-a-bars */}
      <main style={{
        background: 'linear-gradient(180deg, #a50044 0%, #5a0032 15%, #004d98 45%, #003570 70%, #0d1b2a 100%)',
      }}>
        <section id="formulari-registre" style={{padding: 'clamp(40px, 6vw, 80px) 16px clamp(60px, 8vw, 100px)'}}>
          <div style={{maxWidth: 600, margin: '0 auto'}}>
            <ContactForm onOpenLegal={(type) => setLegalOpen(type)} />
          </div>
        </section>
      </main>

      <Footer />
      {legalOpen && <LegalModal type={legalOpen} onClose={() => setLegalOpen(null)} />}
    </>
  )
}
