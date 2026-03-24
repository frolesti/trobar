import { useEffect, useCallback } from 'react'

/* ── Content ── */

function PrivacyContent() {
  return (
    <>
      <h1 style={{fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 8}}>Política de Privacitat</h1>
      <p style={{color: 'var(--muted)', marginBottom: 32, fontSize: 14}}>Última actualització: 22 de març de 2026</p>
      <S title="1. Introducció">A &ldquo;troBar&rdquo;, valorem la teva privacitat. Aquesta Política explica com recollim, utilitzem i protegim les teves dades personals quan utilitzes la nostra aplicació i pàgina web.</S>
      <S title="2. Dades que Recollim"><ul><li><strong>Ubicació:</strong> Utilitzem el GPS del teu dispositiu per mostrar-te els bars més propers.</li><li><strong>Perfil d&apos;Usuari:</strong> Si inicies sessió, guardem el teu nom, correu electrònic i preferències.</li><li><strong>Activitat:</strong> Estadístiques d&apos;ús anònimes per millorar l&apos;experiència.</li><li><strong>Dades de negoci:</strong> Si registres un bar, guardem el nom del local, NIF, adreça, telèfon, email i dades de pagament.</li><li><strong>Dades del Dispositiu:</strong> Informació bàsica del dispositiu com el sistema operatiu i la versió de l&apos;aplicació, per garantir la compatibilitat.</li></ul></S>
      <S title="3. Base Legal del Tractament">Tractem les teves dades personals en base a:<ul><li>El teu consentiment (per exemple, en activar la localització o crear un compte).</li><li>L&apos;execució d&apos;un contracte (quan et registres i acceptes els Termes del Servei).</li><li>El nostre interès legítim (per millorar el servei i garantir la seva seguretat).</li></ul></S>
      <S title="4. Com Utilitzem les Dades"><ul><li>Mostrar-te resultats rellevants segons la teva posició i preferències.</li><li>Enviar-te notificacions sobre partits (si ho has activat).</li><li>Gestionar el perfil i la subscripció del teu establiment.</li><li>Processar subscripcions i pagaments dels comptes de negoci.</li><li>Millorar les funcionalitats de l&apos;aplicació i corregir errors.</li></ul></S>
      <S title="5. Compartició de Dades">No venem ni compartim les teves dades personals amb tercers per a fins publicitaris. Podem compartir dades amb:<ul><li>Proveïdors de serveis (Stripe per a pagaments, Firebase per a autenticació) que tracten les dades en nom nostre.</li><li>Dades agregades i anònimes amb socis per a anàlisi de mercat.</li><li>Autoritats competents si ho requereix la llei.</li></ul></S>
      <S title="6. Retenció de Dades">Conservem les teves dades mentre mantinguis el compte actiu o sigui necessari per oferir-te el servei. Si elimines el teu compte, suprimirem les teves dades personals en un termini raonable, excepte aquelles que estiguem obligats a conservar per raons legals.</S>
      <S title="7. Transferències Internacionals">Alguns dels nostres proveïdors de serveis poden estar ubicats fora de l&apos;Espai Econòmic Europeu. En aquests casos, ens assegurem que existeixin garanties adequades per protegir les teves dades, com ara clàusules contractuals estàndard.</S>
      <S title="8. Els teus Drets">D&apos;acord amb la normativa de protecció de dades, tens dret a:<ul><li>Accedir a les teves dades personals.</li><li>Rectificar dades inexactes o incompletes.</li><li>Sol·licitar la supressió de les teves dades.</li><li>Oposar-te al tractament de les teves dades.</li><li>Sol·licitar la portabilitat de les teves dades en un format estructurat.</li><li>Retirar el teu consentiment en qualsevol moment.</li></ul>Pots eliminar el teu compte directament des de l&apos;aplicació (&ldquo;Perfil&rdquo; → &ldquo;Eliminar Compte&rdquo;). Per exercir qualsevol d&apos;aquests drets, contacta amb nosaltres a <a href="mailto:privacitat@trobar-app.cat">privacitat@trobar-app.cat</a>.</S>
      <S title="9. Menors">troBar no està dirigida a menors de 16 anys. No recollim consciemment dades de menors d&apos;aquesta edat. Si descobrim que hem recopilat dades d&apos;un menor sense el consentiment adequat, les suprimirem el més aviat possible.</S>
      <S title="10. Seguretat">Implementem mesures tècniques i organitzatives per protegir la teva informació contra accessos no autoritzats, pèrdua o alteració. Totes les comunicacions estan xifrades mitjançant TLS. No obstant això, cap sistema és completament segur, per la qual cosa no podem garantir una seguretat absoluta.</S>
      <S title="11. Cookies">La nostra pàgina web utilitza cookies essencials per al funcionament del servei. No utilitzem cookies de seguiment de tercers.</S>
      <S title="12. Canvis en Aquesta Política">Podem actualitzar aquesta Política periòdicament. Si els canvis són significatius, t&apos;informarem a través de l&apos;aplicació o per correu electrònic. La data de l&apos;última actualització apareixerà sempre al principi del document.</S>
      <S title="13. Contacte">Per a qualsevol qüestió relacionada amb la privacitat, pots escriure a <a href="mailto:privacitat@trobar-app.cat">privacitat@trobar-app.cat</a>.</S>
    </>
  )
}

function TermsContent() {
  return (
    <>
      <h1 style={{fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 8}}>Termes i Condicions</h1>
      <p style={{color: 'var(--muted)', marginBottom: 32, fontSize: 14}}>Última actualització: 22 de març de 2026</p>
      <S title="1. Introducció">Benvingut a troBar! Aquests Termes del Servei regeixen l&apos;ús de la nostra aplicació mòbil i pàgina web per localitzar bars i establiments que emeten esdeveniments esportius. En utilitzar &ldquo;troBar&rdquo;, acceptes aquestes condicions íntegrament.</S>
      <S title="2. Acceptació dels Termes">En accedir o utilitzar l&apos;aplicació, confirmes que has llegit, entès i acceptat aquests Termes. Si no estàs d&apos;acord amb alguna part, no has d&apos;utilitzar el servei. Si utilitzes troBar en nom d&apos;una organització, declares que tens l&apos;autoritat per vincular-la a aquests Termes.</S>
      <S title="3. Edat Mínima">Has de tenir almenys 16 anys per utilitzar troBar. Si ets menor d&apos;edat segons la legislació del teu país, necessites el consentiment del teu pare, mare o tutor legal.</S>
      <S title="4. Ús de l'Aplicació">&ldquo;troBar&rdquo; és una eina que permet als usuaris trobar locals on veure esports. Acceptes fer servir aquesta informació exclusivament per a ús personal i no comercial. No està permès:<ul><li>Extreure dades de manera automatitzada (scraping).</li><li>Utilitzar l&apos;aplicació per a finalitats il·lícites.</li><li>Interferir en el funcionament del servei o intentar accedir-hi de forma no autoritzada.</li><li>Utilitzar contingut de troBar per entrenar models d&apos;intel·ligència artificial o aprenentatge automàtic.</li></ul></S>
      <S title="5. Comptes d'Usuari">Per accedir a determinades funcionalitats cal crear un compte. Ets responsable de mantenir la confidencialitat de les teves credencials i de tota l&apos;activitat que es produeixi al teu compte. No pots transferir ni cedir el teu compte a tercers.</S>
      <S title="6. Comptes de Negoci">Els propietaris de bars poden registrar el seu establiment a troBar. En fer-ho, accepten mantenir la informació del local actualitzada (horaris, partits, ofertes) i proporcionar dades veraces. troBar es reserva el dret de suspendre comptes amb informació fraudulenta o múltiples queixes.</S>
      <S title="7. Subscripcions i Pagaments"><ul><li>Els plans de pagament es renoven automàticament segons la periodicitat escollida.</li><li>Pots cancel·lar la subscripció en qualsevol moment des de la secció &ldquo;Configuració&rdquo;.</li><li>Els pagaments es processen de forma segura a través de Stripe.</li><li>No s&apos;ofereixen reemborsaments per períodes ja consumits.</li></ul></S>
      <S title="8. Contingut Generat per l'Usuari">Els usuaris poden deixar ressenyes o suggerir canvis. En fer-ho, ens atorgues una llicència no exclusiva, gratuïta i mundial per utilitzar, reproduir i mostrar aquest contingut dins del servei. Et compromets a proporcionar informació veraç i respectuosa. Ens reservem el dret d&apos;eliminar qualsevol contingut ofensiu o inadequat.</S>
      <S title="9. Precisió de la Informació">Tot i que ens esforcem per mantenir la informació actualitzada, &ldquo;troBar&rdquo; depèn de dades de tercers i dels propis establiments. No garantim que un bar concret emeti un partit específic en tot moment. Recomanem sempre confirmar amb l&apos;establiment.</S>
      <S title="10. Propietat Intel·lectual">Tots els drets sobre el disseny, codi, marca i contingut original de l&apos;aplicació són propietat exclusiva de l&apos;equip de &ldquo;troBar&rdquo;. Els logotips dels equips i competicions pertanyen als seus respectius propietaris i s&apos;utilitzen únicament amb finalitats informatives. No t&apos;és permès copiar, modificar, distribuir ni crear obres derivades del nostre contingut sense autorització prèvia.</S>
      <S title="11. Sense Garanties">El servei es proporciona &ldquo;tal qual&rdquo; i &ldquo;segons disponibilitat&rdquo;. No garantim que el servei sigui ininterromput, segur o lliure d&apos;errors. No oferim cap garantia, expressa o implícita, respecte a la precisió, fiabilitat o adequació del servei per a cap finalitat particular.</S>
      <S title="12. Limitació de Responsabilitat">&ldquo;troBar&rdquo; no es fa responsable dels canvis d&apos;última hora en la programació dels bars ni de la qualitat del servei ofert pels establiments. En cap cas serem responsables de danys indirectes, incidentals, especials o conseqüents derivats de l&apos;ús o la impossibilitat d&apos;ús del servei.</S>
      <S title="13. Indemnització">Acceptes indemnitzar i mantenir indemne l&apos;equip de &ldquo;troBar&rdquo; davant de qualsevol reclamació, dany o despesa derivada del teu ús indegut del servei o de la violació d&apos;aquests Termes.</S>
      <S title="14. Suspensió i Terminació">Ens reservem el dret de suspendre o cancel·lar el teu compte si detectem un ús inadequat, fraudulent o contrari a aquests Termes, sense necessitat de preavís. Tu pots deixar d&apos;utilitzar el servei i eliminar el teu compte en qualsevol moment.</S>
      <S title="15. Modificació dels Termes">Podem actualitzar aquests Termes periòdicament. Si els canvis són significatius, t&apos;informarem a través de l&apos;aplicació o per correu electrònic. Si continues utilitzant el servei després dels canvis, s&apos;entendrà que els acceptes.</S>
      <S title="16. Llei Aplicable i Jurisdicció">Aquests Termes es regeixen per la legislació vigent a Espanya. Per a qualsevol controvèrsia, les parts se sotmeten als jutjats i tribunals de Barcelona, renunciant a qualsevol altre fur que els pogués correspondre.</S>
      <S title="17. Disposicions Generals">Si alguna clàusula d&apos;aquests Termes resultés invàlida, la resta continuarà vigent. El fet que no exercim algun dret no implica que hi renunciem. Aquests Termes constitueixen l&apos;acord complet entre tu i troBar en relació amb l&apos;ús del servei. No existeix cap relació d&apos;associació, agència ni representació entre tu i troBar.</S>
      <S title="18. Contacte">Per a qualsevol dubte, pots contactar-nos a <a href="mailto:suport@trobar-app.cat">suport@trobar-app.cat</a>.</S>
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
