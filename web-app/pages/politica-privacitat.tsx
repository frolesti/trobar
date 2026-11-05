import Head from 'next/head'
import Header from '../components/Header'
import Footer from '../components/Footer'
import LegalBody from '../components/LegalBody'
import { PRIVACY } from '../lib/legalContent'

export default function PoliticaPrivacitat() {
  return (
    <>
      <Head>
        <title>troBar — Política de privacitat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />
      <main style={{ padding: '112px 24px 48px' }}>
        <LegalBody doc={PRIVACY} />
      </main>
      <Footer />
    </>
  )
}
