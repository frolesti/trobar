import Head from 'next/head'
import Header from '../components/Header'
import ContactForm from '../components/ContactForm'
import Footer from '../components/Footer'
import LegalModal from '../components/LegalModal'
import { useState } from 'react'

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

      {/* Hero — sense fons propi, el degradat global flueix */}
      <section style={{
        padding: 'clamp(140px, 14vw, 180px) 24px clamp(40px, 6vw, 70px)',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }} className="fade-up">
          <span className="eyebrow">Per a bars i restaurants</span>
          <h1 style={{ marginBottom: 20 }}>
            Fes créixer el teu <em style={{ color: 'var(--gold)', fontWeight: 500 }}>negoci</em>
          </h1>
          <p style={{ fontSize: 18, maxWidth: 520, margin: '0 auto' }}>
            Crea el teu compte ara i comença a atraure centenars de culers cada dia de partit.
          </p>
        </div>
      </section>

      <main>
        <section id="formulari-registre" style={{ padding: 'clamp(20px, 4vw, 40px) 16px clamp(80px, 8vw, 120px)' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <ContactForm onOpenLegal={(type) => setLegalOpen(type)} />
          </div>
        </section>
      </main>

      <Footer />
      {legalOpen && <LegalModal type={legalOpen} onClose={() => setLegalOpen(null)} />}
    </>
  )
}
