import { useEffect, useCallback } from 'react'

/* ── Content ── */

function PrivacyContent() {
  return (
    <>
      <h1 style={{fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 8}}>Política de Privacitat</h1>
      <p style={{color: 'var(--muted)', marginBottom: 32, fontSize: 14}}>Última actualització: 11 de març de 2026</p>
      <S title="1. Introducció">A &ldquo;troBar&rdquo;, valorem la teva privacitat. Aquesta Política explica com recollim, utilitzem i protegim les teves dades personals quan utilitzes la nostra aplicació i pàgina web.</S>
      <S title="2. Dades que Recollim"><ul><li><strong>Ubicació:</strong> Utilitzem el GPS del teu dispositiu per mostrar-te els bars més propers.</li><li><strong>Perfil d&apos;Usuari:</strong> Si inicies sessió, guardem el teu nom, correu electrònic i preferències.</li><li><strong>Activitat:</strong> Estadístiques d&apos;ús anònimes per millorar l&apos;experiència.</li><li><strong>Dades de negoci:</strong> Si registres un bar, guardem el nom del local, NIF, adreça, telèfon, email i dades de pagament.</li></ul></S>
      <S title="3. Com Utilitzem les Dades"><ul><li>Mostrar-te resultats rellevants segons la teva posició i preferències.</li><li>Enviar-te notificacions sobre partits (si ho has activat).</li><li>Gestionar el perfil i la subscripció del teu establiment.</li><li>Millorar les funcionalitats de l&apos;aplicació i corregir errors.</li></ul></S>
      <S title="4. Compartició de Dades">No venem ni compartim les teves dades personals amb tercers per a fins publicitaris. Podem compartir dades agregades i anònimes amb socis per a anàlisi de mercat. Les dades de pagament són processades de forma segura per Stripe i mai arriben als nostres servidors.</S>
      <S title="5. Els teus Drets (GDPR)">Tens dret a accedir, rectificar i suprimir les teves dades en qualsevol moment. Pots eliminar el teu compte directament des de l&apos;aplicació (&ldquo;Perfil&rdquo; → &ldquo;Eliminar Compte&rdquo;). Per a sol·licituds, contacta amb nosaltres a <a href="mailto:privacitat@trobar-app.cat">privacitat@trobar-app.cat</a>.</S>
      <S title="6. Seguretat">Implementem mesures tècniques i organitzatives per protegir la teva informació contra accessos no autoritzats, pèrdua o alteració. Totes les comunicacions estan xifrades mitjançant TLS.</S>
      <S title="7. Cookies">La nostra pàgina web utilitza cookies essencials per al funcionament del servei. No utilitzem cookies de seguiment de tercers.</S>
      <S title="8. Contacte">Per a qualsevol qüestió relacionada amb la privacitat, pots escriure a <a href="mailto:privacitat@trobar-app.cat">privacitat@trobar-app.cat</a>.</S>
    </>
  )
}

function TermsContent() {
  return (
    <>
      <h1 style={{fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 8}}>Termes i Condicions</h1>
      <p style={{color: 'var(--muted)', marginBottom: 32, fontSize: 14}}>Última actualització: 11 de març de 2026</p>
      <S title="1. Introducció">Benvingut a troBar! Aquests Termes del Servei regeixen l&apos;ús de la nostra aplicació mòbil i pàgina web per localitzar bars i establiments que emeten esdeveniments esportius. En utilitzar &ldquo;troBar&rdquo;, acceptes aquestes condicions íntegrament.</S>
      <S title="2. Ús de l'Aplicació">&ldquo;troBar&rdquo; és una eina que permet als usuaris trobar locals on veure esports. Acceptes fer servir aquesta informació exclusivament per a ús personal i no comercial. No està permès extreure dades de manera automatitzada (scraping) ni utilitzar l&apos;aplicació per a finalitats il·lícites.</S>
      <S title="3. Comptes de Negoci">Els propietaris de bars poden registrar el seu establiment a troBar. En fer-ho, accepten mantenir la informació del local actualitzada (horaris, partits, ofertes) i proporcionar dades veraces. troBar es reserva el dret de suspendre comptes amb informació fraudulenta o múltiples queixes.</S>
      <S title="4. Subscripcions i Pagaments"><ul><li>Els plans de pagament es renoven mensualment de forma automàtica.</li><li>Pots cancel·lar la subscripció en qualsevol moment amb un preavís de 15 dies.</li><li>Els pagaments es processen de forma segura a través de Stripe.</li><li>No s&apos;ofereixen reemborsaments per períodes ja consumits.</li></ul></S>
      <S title="5. Contingut Generat per l'Usuari">Els usuaris poden deixar ressenyes o suggerir canvis. En fer-ho, ens atorgues una llicència no exclusiva per utilitzar aquest contingut. Et compromets a proporcionar informació veraç i respectuosa. Ens reservem el dret d&apos;eliminar qualsevol contingut ofensiu.</S>
      <S title="6. Propietat Intel·lectual">Tots els drets sobre el disseny, codi i contingut original de l&apos;aplicació són propietat de l&apos;equip de &ldquo;troBar&rdquo;. Els logotips dels equips i competicions pertanyen als seus respectius propietaris i s&apos;utilitzen únicament amb finalitats informatives.</S>
      <S title="7. Limitació de Responsabilitat">&ldquo;troBar&rdquo; no es fa responsable dels canvis d&apos;última hora en la programació dels bars ni de la qualitat del servei ofert pels establiments llistats a l&apos;aplicació.</S>
      <S title="8. Contacte">Per a qualsevol dubte, pots contactar-nos a <a href="mailto:suport@trobar-app.cat">suport@trobar-app.cat</a>.</S>
    </>
  )
}

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{marginBottom: 28}}>
      <h2 style={{fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 10}}>{title}</h2>
      <div style={{color: 'var(--muted)', lineHeight: 1.7, fontSize: 15}}>{children}</div>
    </div>
  )
}

/* ── Modal ── */

type LegalType = 'privacy' | 'terms'

interface LegalModalProps {
  type: LegalType
  onClose: () => void
}

export default function LegalModal({ type, onClose }: LegalModalProps) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKey)
    }
  }, [handleKey])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'legalFadeIn 0.2s ease-out'
      }}
    >
      <style>{`
        @keyframes legalFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes legalSlideUp { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          width: '100%',
          maxWidth: 720,
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '48px 40px',
          position: 'relative',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          animation: 'legalSlideUp 0.25s ease-out'
        }}
      >
        <button
          onClick={onClose}
          aria-label="Tancar"
          style={{
            position: 'sticky',
            top: 0,
            float: 'right',
            background: '#f3f3f3',
            border: 'none',
            width: 36,
            height: 36,
            borderRadius: '50%',
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            color: 'var(--text)'
          }}
        >
          ✕
        </button>
        {type === 'privacy' ? <PrivacyContent /> : <TermsContent />}
      </div>
    </div>
  )
}
