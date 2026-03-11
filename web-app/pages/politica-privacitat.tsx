import Head from 'next/head'
import Header from '../components/Header'
import Footer from '../components/Footer'

export default function PoliticaPrivacitat() {
  return (
    <>
      <Head>
        <title>troBar — Política de Privacitat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />

      <main className="page-container" style={{maxWidth: 800, margin: '0 auto', padding: '140px 24px 60px'}}>
        <div style={{background: '#fff', borderRadius: 20, padding: '48px 40px', boxShadow: '0 12px 40px rgba(0,0,0,0.15)'}}>
        <h1 style={{fontSize: 36, fontWeight: 800, color: 'var(--text)', marginBottom: 8}}>Política de Privacitat</h1>
        <p style={{color: 'var(--muted)', marginBottom: 40, fontSize: 14}}>Última actualització: 11 de març de 2026</p>

        <Section title="1. Introducció">
          A &ldquo;troBar&rdquo;, valorem la teva privacitat. Aquesta Política explica com recollim, utilitzem i protegim les teves dades personals quan utilitzes la nostra aplicació i pàgina web.
        </Section>

        <Section title="2. Dades que Recollim">
          <ul>
            <li><strong>Ubicació:</strong> Utilitzem el GPS del teu dispositiu per mostrar-te els bars més propers.</li>
            <li><strong>Perfil d&apos;Usuari:</strong> Si inicies sessió, guardem el teu nom, correu electrònic i preferències.</li>
            <li><strong>Activitat:</strong> Estadístiques d&apos;ús anònimes per millorar l&apos;experiència.</li>
            <li><strong>Dades de negoci:</strong> Si registres un bar, guardem el nom del local, NIF, adreça, telèfon, email i dades de pagament.</li>
          </ul>
        </Section>

        <Section title="3. Com Utilitzem les Dades">
          <ul>
            <li>Mostrar-te resultats rellevants segons la teva posició i preferències.</li>
            <li>Enviar-te notificacions sobre partits (si ho has activat).</li>
            <li>Gestionar el perfil i la subscripció del teu establiment.</li>
            <li>Millorar les funcionalitats de l&apos;aplicació i corregir errors.</li>
          </ul>
        </Section>

        <Section title="4. Compartició de Dades">
          No venem ni compartim les teves dades personals amb tercers per a fins publicitaris. Podem compartir dades agregades i anònimes amb socis per a anàlisi de mercat. Les dades de pagament són processades de forma segura per Stripe i mai arriben als nostres servidors.
        </Section>

        <Section title="5. Els teus Drets (GDPR)">
          Tens dret a accedir, rectificar i suprimir les teves dades en qualsevol moment. Pots eliminar el teu compte directament des de l&apos;aplicació (&ldquo;Perfil&rdquo; → &ldquo;Eliminar Compte&rdquo;). Per a sol·licituds, contacta amb nosaltres a <a href="mailto:privacitat@trobar-app.cat">privacitat@trobar-app.cat</a>.
        </Section>

        <Section title="6. Seguretat">
          Implementem mesures tècniques i organitzatives per protegir la teva informació contra accessos no autoritzats, pèrdua o alteració. Totes les comunicacions estan xifrades mitjançant TLS.
        </Section>

        <Section title="7. Cookies">
          La nostra pàgina web utilitza cookies essencials per al funcionament del servei. No utilitzem cookies de seguiment de tercers.
        </Section>

        <Section title="8. Contacte">
          Per a qualsevol qüestió relacionada amb la privacitat, pots escriure a <a href="mailto:privacitat@trobar-app.cat">privacitat@trobar-app.cat</a>.
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
