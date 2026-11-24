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
      <p role="note" style={{ maxWidth: 720, margin: '0 auto', padding: '100px 24px 0', color: 'var(--brand-grana)', textAlign: 'center' }}>
        Estem en fase beta. Els pagaments es fan en mode de proves i no es cobren diners reals.
      </p>
      {!confirming && (
      <section className="register-hero" style={{
        padding: '32px 24px 24px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }} className="fade-up register-hero-inner">
          <h1 style={{ marginBottom: 16 }}>
            Donem d’alta el teu bar
          </h1>
          <p style={{ fontSize: 18, maxWidth: 520, margin: '0 auto' }}>
            Tens 14 dies per provar Premium. Primer crearem el compte
            i després hi afegirem el teu local.
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
