import Head from 'next/head'
import Header from '../components/Header'
import Footer from '../components/Footer'

export default function TermesCondicions() {
  return (
    <>
      <Head>
        <title>troBar — Termes i Condicions</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />

      <main className="page-container" style={{maxWidth: 800, margin: '0 auto', padding: '140px 24px 60px'}}>
        <div style={{background: '#fff', borderRadius: 20, padding: '48px 40px', boxShadow: '0 12px 40px rgba(0,0,0,0.15)'}}>
        <h1 style={{fontSize: 36, fontWeight: 800, color: 'var(--text)', marginBottom: 8}}>Termes i Condicions</h1>
        <p style={{color: 'var(--muted)', marginBottom: 40, fontSize: 14}}>Última actualització: 11 de març de 2026</p>

        <Section title="1. Introducció">
          Benvingut a troBar! Aquests Termes del Servei regeixen l&apos;ús de la nostra aplicació mòbil i pàgina web per localitzar bars i establiments que emeten esdeveniments esportius. En utilitzar &ldquo;troBar&rdquo;, acceptes aquestes condicions íntegrament.
        </Section>

        <Section title="2. Ús de l'Aplicació">
          &ldquo;troBar&rdquo; és una eina que permet als usuaris trobar locals on veure esports. Acceptes fer servir aquesta informació exclusivament per a ús personal i no comercial. No està permès extreure dades de manera automatitzada (scraping) ni utilitzar l&apos;aplicació per a finalitats il·lícites.
        </Section>

        <Section title="3. Comptes de Negoci">
          Els propietaris de bars poden registrar el seu establiment a troBar. En fer-ho, accepten mantenir la informació del local actualitzada (horaris, partits, ofertes) i proporcionar dades veraces. troBar es reserva el dret de suspendre comptes amb informació fraudulenta o múltiples queixes.
        </Section>

        <Section title="4. Subscripcions i Pagaments">
          <ul>
            <li>Els plans de pagament es renoven mensualment de forma automàtica.</li>
            <li>Pots cancel·lar la subscripció en qualsevol moment amb un preavís de 15 dies.</li>
            <li>Els pagaments es processen de forma segura a través de Stripe.</li>
            <li>No s&apos;ofereixen reemborsaments per períodes ja consumits.</li>
          </ul>
        </Section>

        <Section title="5. Contingut Generat per l'Usuari">
          Els usuaris poden deixar ressenyes o suggerir canvis. En fer-ho, ens atorgues una llicència no exclusiva per utilitzar aquest contingut. Et compromets a proporcionar informació veraç i respectuosa. Ens reservem el dret d&apos;eliminar qualsevol contingut ofensiu.
        </Section>

        <Section title="6. Propietat Intel·lectual">
          Tots els drets sobre el disseny, codi i contingut original de l&apos;aplicació són propietat de l&apos;equip de &ldquo;troBar&rdquo;. Els logotips dels equips i competicions pertanyen als seus respectius propietaris i s&apos;utilitzen únicament amb finalitats informatives.
        </Section>

        <Section title="7. Limitació de Responsabilitat">
          &ldquo;troBar&rdquo; no es fa responsable dels canvis d&apos;última hora en la programació dels bars ni de la qualitat del servei ofert pels establiments llistats a l&apos;aplicació.
        </Section>

        <Section title="8. Contacte">
          Per a qualsevol dubte, pots contactar-nos a <a href="mailto:suport@trobar-app.cat">suport@trobar-app.cat</a>.
        </Section>
        </div>
      </main>

      <Footer />
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{marginBottom: 32}}>
      <h2 style={{fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 12}}>{title}</h2>
      <div style={{color: 'var(--muted)', lineHeight: 1.7, fontSize: 16}}>{children}</div>
    </div>
  )
}
