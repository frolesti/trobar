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
      
      <main className="container" style={{maxWidth: 1200, margin: '0 auto', padding: '120px 24px 40px'}}>
        
        <div style={{textAlign: 'center', marginBottom: 40}}>
          <h1 style={{fontSize: 'clamp(36px, 5vw, 54px)', fontWeight: 800, color: 'var(--text)', marginBottom: 16}}>Fes créixer el teu negoci</h1>
          <p style={{fontSize: 20, color: 'var(--muted)', maxWidth: 640, margin: '0 auto'}}>Crea el teu compte ara i comença a atraure centenars de culers cada dia de partit.</p>
        </div>

        <section id="formulari-registre" style={{marginTop: 60, marginBottom: 80}}>
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
