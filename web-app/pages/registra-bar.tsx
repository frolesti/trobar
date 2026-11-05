import Head from 'next/head'
import Header from '../components/Header'
import ContactForm from '../components/ContactForm'
import Footer from '../components/Footer'
import LegalModal from '../components/LegalModal'
import { useState } from 'react'
import { useRouter } from 'next/router'

type LegalType = 'privacy' | 'terms'

export default function RegisterBar() {
  const [legalOpen, setLegalOpen] = useState<LegalType | null>(null)
  const [formStep, setFormStep] = useState(1)
  const router = useRouter()
  const confirming = formStep === 6 || (router.query.checkout === 'success' && formStep === 1)

  return (
    <>
      <Head>
        <title>troBar — Registra el teu local</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />

      <main className={confirming ? 'register-page register-page--confirmation' : 'register-page'}>
      {!confirming && (
      <section className="register-hero" style={{
        padding: '112px 24px 24px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }} className="fade-up register-hero-inner">
          <span className="eyebrow">Per a bars i restaurants</span>
          <h1 style={{ marginBottom: 16 }}>
            Fes créixer el teu <em style={{ color: 'var(--gold)', fontWeight: 500 }}>negoci</em>
          </h1>
          <p style={{ fontSize: 18, maxWidth: 520, margin: '0 auto' }}>
            Dona d’alta el teu bar amb 14 dies de prova.
            El pagament es gestiona de forma segura amb Stripe.
          </p>
        </div>
      </section>
      )}

        <section id="formulari-registre" className="register-form-wrap">
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <ContactForm onOpenLegal={(type) => setLegalOpen(type)} onStepChange={setFormStep} />
          </div>
        </section>
      </main>

      <Footer />
      {legalOpen && <LegalModal type={legalOpen} onClose={() => setLegalOpen(null)} />}
    </>
  )
}
