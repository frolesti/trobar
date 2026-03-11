import Head from 'next/head'
import Header from '../components/Header'
import ContactForm from '../components/ContactForm'
import Footer from '../components/Footer'

export default function RegisterBar() {
  return (
    <>
      <Head>
        <title>troBar — Registra el teu bar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />
      
      <main className="container" style={{maxWidth: 1200, margin: '0 auto', padding: '120px 24px 40px'}}>
        
        <div style={{textAlign: 'center', marginBottom: 40}}>
          <h1 style={{fontSize: 'clamp(36px, 5vw, 54px)', fontWeight: 800, color: '#fff', marginBottom: 16}}>Fes créixer el teu negoci</h1>
          <p style={{fontSize: 20, color: 'rgba(255,255,255,0.7)', maxWidth: 640, margin: '0 auto'}}>Crea el teu compte ara i comença a atraure centenars de culers cada dia de partit.</p>
        </div>

        <section id="formulari-registre" style={{marginTop: 60, marginBottom: 80}}>
          <div style={{maxWidth: 600, margin: '0 auto'}}>
            <ContactForm />
          </div>

          <div style={{maxWidth: 600, margin: '40px auto 0', padding: '32px', background: 'var(--card)', borderRadius: '16px', fontSize: '14px', color: 'var(--muted)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)'}}>
            <h3 style={{fontSize: '18px', color: 'var(--text)', marginBottom: '16px', fontWeight: 700}}>Condicions de l&apos;acord</h3>
            <p style={{marginBottom: '12px', lineHeight: 1.6}}>En enviar aquest formulari i donar d&apos;alta el vostre establiment a troBar, accepteu les següents condicions contractuals:</p>
            <ul style={{paddingLeft: '20px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.6}}>
              <li><strong>Veracitat de les dades:</strong> L&apos;establiment es compromet a mantenir la informació actualitzada, especialment els horaris d&apos;obertura i els partits oferts.</li>
              <li><strong>Preus i subscripció:</strong> El cobrament del vostre pla es farà efectiu de manera mensual. Teniu dret a cancel·lar la subscripció en qualsevol moment amb un preavís de 15 dies.</li>
              <li><strong>Reserva de dret:</strong> troBar es reserva el dret a donar de baixa automàticament aquells perfils que falsifiquin ofertes, mostrin un comportament fraudulent o tinguin múltiples queixes per part dels usuaris de l&apos;aplicació.</li>
            </ul>
            <p style={{fontSize: '13px'}}>Les vostres dades seran processades únicament per a la gestió de la xarxa d&apos;hostaleria. Si us plau, consulteu la nostra <a href="/politica-privacitat" style={{color: 'var(--accent)', textDecoration: 'underline'}}>Política de Privacitat</a> per a més detalls.</p>
          </div>
        </section>

      </main>

      <Footer />
    </>
  )
}
