import Head from 'next/head'
import Header from '../components/Header'
import Footer from '../components/Footer'
import LegalBody from '../components/LegalBody'
import { TERMS } from '../lib/legalContent'

export default function TermesCondicions() {
  return (
    <>
      <Head>
        <title>troBar — Termes del servei</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />
      <main style={{ padding: '140px 24px 80px' }}>
        <LegalBody doc={TERMS} />
      </main>
      <Footer />
    </>
  )
}
