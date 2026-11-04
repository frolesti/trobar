import { useState, useEffect, useRef } from 'react'
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, updateProfile, fetchSignInMethodsForEmail, onAuthStateChanged } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { doc, getDocFromServer } from 'firebase/firestore'
import { stdnum } from 'stdnum'
import { auth, db, functions } from '../lib/firebase'

/* ═══════════════════════════════════════════════════════════════════════════
   ContactForm — Flux de registre en 6 passos
   ═══════════════════════════════════════════════════════════════════════════
   Pas 1: Email + contrasenya + nom → crear compte Firebase Auth → enviar verificació
   Pas 2: Esperar verificació d'email (polling automàtic)
   Pas 3: Cercar el bar (Google Places) → auto-omple dades
   Pas 4: Dades del negoci (pre-omplert si s'ha cercat)
   Pas 5: Selecció de facturació + confirmació
   Pas 6: Benvingut!
   ═══════════════════════════════════════════════════════════════════════════ */

type BillingCycle = 'monthly' | 'quarterly' | 'annual'

const CYCLES: Record<BillingCycle, { label: string; price: number; savePct?: string; saveYear?: number }> = {
  monthly:   { label: 'Mensual',    price: 39 },
  quarterly: { label: 'Trimestral', price: 33, savePct: '15%', saveYear: 72 },
  annual:    { label: 'Anual',      price: 29, savePct: '25%', saveYear: 120 },
}

interface LocationSuggestion {
  placeId: string
  primaryText: string
  secondaryText: string
}

interface LocationDetails {
  placeId: string
  name: string
  address: string
  city: string
  postalCode: string
  latitude: number
  longitude: number
}

interface FormState {
  /* Dades del local */
  businessName: string
  address: string
  city: string
  postalCode: string
  phone: string
  website: string
  location: { latitude: number; longitude: number } | null
  googlePlaceId: string | null
  /* Dades legals */
  nif: string
  legalName: string
  /* Contacte */
  contactName: string
  contactPhone: string
  password: string
  /* Detalls del local */
  capacity: string
  screens: string
  openingHours: string
  description: string
  /* Facturació */
  billing: BillingCycle
  /* Acceptació */
  acceptTerms: boolean
}

const initialState: FormState = {
  businessName: '', address: '', city: '', postalCode: '', phone: '', website: '',
  location: null,
  googlePlaceId: null,
  nif: '', legalName: '',
  contactName: '', contactPhone: '', password: '',
  capacity: '', screens: '', openingHours: '', description: '',
  billing: 'quarterly',
  acceptTerms: false,
}

interface ContactFormProps {
  onOpenLegal?: (type: 'privacy' | 'terms') => void
}

interface PasswordChecks {
  minLength: boolean
  hasLower: boolean
  hasUpper: boolean
  hasNumber: boolean
  hasSymbol: boolean
}

function getPasswordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= 8,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  }
}

function getPasswordStrength(password: string): { score: number; label: string } {
  const checks = getPasswordChecks(password)
  const score = Object.values(checks).filter(Boolean).length
  if (!password) return { score: 0, label: 'Introdueix una contrasenya' }
  if (score <= 2) return { score, label: 'Feble' }
  if (score <= 4) return { score, label: 'Acceptable' }
  return { score, label: 'Forta' }
}

function getFriendlyAuthError(err: unknown): string {
  const fbErr = err as { code?: string; message?: string }
  switch (fbErr.code) {
    case 'auth/email-already-in-use':
      return 'Aquest email ja està registrat. Si és teu, prova la contrasenya correcta o recupera-la des de l\'app.'
    case 'auth/invalid-email':
      return "Format d'email invàlid"
    case 'auth/weak-password':
      return 'Contrasenya massa feble. Fes-la més robusta (8+ caràcters, majúscula, número i símbol).'
    case 'auth/admin-restricted-operation':
      return 'Firebase té restringida la creació de comptes. Revisa Authentication > Settings > User actions i habilita Create (sign-up).'
    case 'auth/operation-not-allowed':
      return 'El proveïdor email/contrasenya no està habilitat a Authentication > Sign-in method del projecte Firebase.'
    case 'auth/too-many-requests':
      return 'Massa intents seguits. Espera uns minuts i torna-ho a provar.'
    case 'auth/network-request-failed':
      return 'Error de connexió. Comprova internet i torna-ho a provar.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Contrasenya incorrecta per aquest email.'
    default:
      return 'No s\'ha pogut completar el registre ara mateix. Torna-ho a provar.'
  }
}

function getFriendlyFunctionError(error: unknown, checkout = false): string {
  const code = (error as { code?: string })?.code
  if (code === 'functions/unauthenticated') return 'Torna a iniciar sessió per continuar.'
  if (code === 'functions/permission-denied') return 'El compte no té permís per gestionar aquest bar.'
  if (code === 'functions/invalid-argument') return (error as { message?: string }).message || 'Revisa les dades del formulari abans de continuar.'
  if (code === 'functions/resource-exhausted') return 'La cerca està ocupada. Espera uns segons i torna-ho a provar.'
  if (code === 'functions/unavailable') return 'El servei no està disponible ara mateix. Torna-ho a provar.'
  if (checkout && code === 'functions/failed-precondition') {
    return 'No podem obrir un Checkout nou: revisa si ja tens una subscripció o un Checkout pendent. Si no, contacta amb suport; la facturació pot estar pendent de configuració.'
  }
  return checkout
    ? "No s'ha pogut iniciar el pagament. El registre s'ha conservat; torna-ho a provar."
    : "No s'ha pogut confirmar el perfil desat. Reintenta el registre amb el mateix compte i comprova la verificació de l'email."
}

/* ── Estils constants ─────────────────────────────────────────────────── */
const formAccent = 'var(--gold)'
const formAccentSoft = 'rgba(201,171,114,0.10)'
const formAccentBorder = 'rgba(201,171,114,0.28)'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', marginTop: 6, borderRadius: 12,
  border: '2px solid var(--border)', fontSize: 16, fontFamily: 'inherit',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontWeight: 600, fontSize: 14, color: 'var(--text)', display: 'block',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: formAccent, textTransform: 'uppercase',
  letterSpacing: 1, marginBottom: 16, marginTop: 8,
}

const buttonPrimary: React.CSSProperties = {
  width: '100%', padding: 16, borderRadius: 14,
  background: formAccent, color: 'var(--black)',
  fontWeight: 'bold', fontSize: 16, border: 'none',
  cursor: 'pointer', transition: 'all 0.2s',
  boxShadow: '0 8px 24px rgba(201,171,114,0.15)',
}

const buttonSecondary: React.CSSProperties = {
  width: '100%', padding: 14, borderRadius: 14,
  background: 'transparent', color: 'var(--muted)',
  fontWeight: 600, fontSize: 14, border: '2px solid var(--border)',
  cursor: 'pointer', transition: 'all 0.2s', marginTop: 12,
}

/* ═══════════════════════════════════════════════════════════════════════════ */

export default function ContactForm({ onOpenLegal }: ContactFormProps) {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>(initialState)
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordTips, setShowPasswordTips] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [existingAccount, setExistingAccount] = useState<null | 'password' | 'google.com' | 'apple.com' | 'other'>(null)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [subscription, setSubscription] = useState<{ active: boolean; status?: string } | null>(null)
  const emailCheckVersion = useRef(0)

  useEffect(() => {
    const billing = new URLSearchParams(window.location.search).get('billing') as BillingCycle
    if (Object.keys(CYCLES).includes(billing)) setState(s => ({ ...s, billing }))
  }, [])

  useEffect(() => onAuthStateChanged(auth, async user => {
    if (!user) return
    try {
      await user.reload()
      await user.getIdToken(true)
      setEmail(user.email || '')
      const owner = await getDocFromServer(doc(db, 'barOwners', user.uid))
      if (owner.exists()) {
        const data = owner.data()
        const profile = await getDocFromServer(doc(db, 'users', user.uid))
        const token = await user.getIdTokenResult()
        setState(s => ({ ...s, businessName: data.barName || '', contactName: data.name || '',
          billing: Object.keys(CYCLES).includes(data.billingCycle) ? data.billingCycle : 'quarterly' }))
        setStep(profile.data()?.role === 'bar_owner' && profile.data()?.ownedBars?.includes(data.barId) && token.claims.role === 'bar_owner' ? 6 : 3)
      } else {
        setState(s => ({ ...s, contactName: user.displayName || s.contactName }))
        setStep(user.emailVerified ? 3 : 2)
      }
    } catch {
      setStatus("No s'ha pogut recuperar el registre. Torna a iniciar sessió o reintenta la connexió.")
    }
  }), [])

  useEffect(() => {
    if (step !== 6) return
    const check = httpsCallable<Record<string, never>, { active: boolean; status?: string }>(functions, 'getSubscriptionStatus')
    check({}).then(result => setSubscription(result.data)).catch(() => {
      setStatus("El bar està registrat, però no s'ha pogut comprovar la subscripció. La redirecció no confirma el pagament.")
    })
  }, [step])

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
  const emailError = emailTouched && email.trim() !== '' && !isValidEmail(email)

  const checkEmailExists = async (rawEmail: string) => {
    const value = rawEmail.trim().toLowerCase()
    if (!isValidEmail(value)) return
    const version = ++emailCheckVersion.current
    setCheckingEmail(true)
    try {
      const methods = await fetchSignInMethodsForEmail(auth, value)
      if (version !== emailCheckVersion.current) return
      if (methods.includes('password')) setExistingAccount('password')
      else if (methods.includes('google.com')) setExistingAccount('google.com')
      else if (methods.includes('apple.com')) setExistingAccount('apple.com')
      else if (methods.length > 0) setExistingAccount('other')
      else setExistingAccount(null)
    } catch {
      // Si Firebase té protecció anti-enumeration, ho detectarem en el submit.
    } finally {
      if (version === emailCheckVersion.current) setCheckingEmail(false)
    }
  }

  const existingAccountMessage = (() => {
    switch (existingAccount) {
      case 'password':
        return 'Aquest email ja està registrat. Introdueix la contrasenya del compte per continuar.'
      case 'google.com':
        return 'Aquest email ja està vinculat a un compte Google. Fes servir un altre email per registrar el bar.'
      case 'apple.com':
        return 'Aquest email ja està vinculat a un compte Apple. Fes servir un altre email per registrar el bar.'
      case 'other':
        return 'Aquest email ja té un compte. Fes servir un altre email per registrar el bar.'
      default:
        return null
    }
  })()

  /* ── Cerca de bar ──────────────────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<LocationSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const searchVersion = useRef(0)
  const searchSession = useRef<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Cooldown timer ────────────────────────────────────────────────── */
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const changesAddress = ['address', 'city', 'postalCode'].includes(key)
    if (changesAddress) setSearchResults([])
    setState(s => ({ ...s,
      [key]: (e.target as HTMLInputElement).type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value,
      ...(changesAddress ? { location: null, googlePlaceId: null } : {}),
    }))
  }

  const passwordChecks = getPasswordChecks(state.password)
  const passwordStrength = getPasswordStrength(state.password)

  /* ── PAS 1: Crear compte Firebase Auth + enviar verificació ──────────── */
  const handleCreateAccount = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    const name = state.contactName.trim()
    const pwd = state.password

    if (!normalizedEmail || !name || !pwd) {
      setStatus('Omple tots els camps')
      return
    }
    if (!isValidEmail(normalizedEmail)) {
      setEmailTouched(true)
      return
    }
    if (existingAccount && existingAccount !== 'password') {
      return
    }
    if (pwd.length < 8) {
      setStatus('La contrasenya ha de tenir mínim 8 caràcters')
      return
    }

    setLoading(true)
    setStatus(null)

    try {
      let userCred
      try {
        userCred = await createUserWithEmailAndPassword(auth, normalizedEmail, pwd)
      } catch (err: unknown) {
        const fbErr = err as { code?: string; message?: string }
        if (fbErr.code === 'auth/email-already-in-use') {
          userCred = await signInWithEmailAndPassword(auth, normalizedEmail, pwd)
        } else if (fbErr.code === 'auth/weak-password') {
          setStatus('La contrasenya és massa feble')
          return
        } else if (fbErr.code === 'auth/invalid-email') {
          setEmailTouched(true)
          return
        } else {
          throw err
        }
      }

      if (userCred?.user) {
        if (!userCred.user.displayName) await updateProfile(userCred.user, { displayName: name })
        await userCred.user.reload()
        await userCred.user.getIdToken(true)
        const owner = await getDocFromServer(doc(db, 'barOwners', userCred.user.uid))
        if (owner.exists()) {
          const data = owner.data()
          const profile = await getDocFromServer(doc(db, 'users', userCred.user.uid))
          const token = await userCred.user.getIdTokenResult()
          setState(s => ({ ...s, password: '', businessName: data.barName || '',
            billing: Object.keys(CYCLES).includes(data.billingCycle) ? data.billingCycle : 'quarterly' }))
          setStep(profile.data()?.role === 'bar_owner' && profile.data()?.ownedBars?.includes(data.barId) && token.claims.role === 'bar_owner' ? 6 : 3)
          return
        }
        setState(s => ({ ...s, password: '' }))
        setStep(userCred.user.emailVerified ? 3 : 2)
        if (!userCred.user.emailVerified) await sendEmailVerification(userCred.user)
      }
      setCooldown(60)
      setStatus(null)
    } catch (err: unknown) {
      setStatus(getFriendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  /* ── PAS 2: Polling automàtic de verificació d'email ────────────────── */
  useEffect(() => {
    if (step !== 2) return
    const interval = setInterval(async () => {
      const user = auth.currentUser
      if (user) {
        try {
          await user.reload()
          if (user.emailVerified) {
            await user.getIdToken(true)
            setStep(3)
            setStatus(null)
          }
        } catch {
          setStatus("No podem comprovar la verificació. Reintentarem quan torni la connexió.")
        }
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [step])

  const handleResendVerification = async () => {
    if (cooldown > 0) return
    const user = auth.currentUser
    if (user) {
      try {
        await sendEmailVerification(user)
        setCooldown(60)
        setStatus(null)
      } catch {
        setStatus('Error reenviant el correu. Espera uns segons.')
      }
    }
  }

  /* ── PAS 3: Coincidències de locals ───────────────────────────────── */
  const searchLocations = async (query: string, version = searchVersion.current) => {
    if (version !== searchVersion.current) return
    if (query.trim().length < 3 || query.length > 200) {
      setStatus('Escriu entre 3 i 200 caràcters per cercar.')
      return
    }
    setSearching(true)
    setSearchResults([])
    setStatus(null)

    try {
      if (!searchSession.current) searchSession.current = window.crypto.randomUUID()
      await auth.currentUser?.getIdToken()
      const search = httpsCallable<{ query: string; sessionToken: string }, { results: LocationSuggestion[] }>(functions, 'searchRegistrationLocations')
      const { data: { results: data } } = await search({ query: query.trim(), sessionToken: searchSession.current })
      if (version !== searchVersion.current) return
      setSearchResults(data)
      setActiveSuggestion(-1)
      if (data.length === 0) {
        setStatus('No trobem cap coincidència. Afegeix el municipi o introdueix les dades del bar manualment.')
      }
    } catch (error) {
      if (version === searchVersion.current) setStatus(getFriendlyFunctionError(error))
    } finally {
      if (version === searchVersion.current) setSearching(false)
    }
  }

  useEffect(() => {
    if (step !== 3 || searchQuery.trim().length < 3) {
      setSearching(false)
      return
    }
    const version = ++searchVersion.current
    searchTimer.current = setTimeout(() => { void searchLocations(searchQuery, version) }, 450)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); searchVersion.current++ }
  }, [searchQuery, step])

  const handleLocateAddress = async () => {
    if (![state.address, state.city, state.postalCode].every(value => value.trim())) {
      setStatus('Omple l’adreça, la ciutat i el codi postal abans de localitzar el bar.')
      return
    }
    await searchLocations(`${state.address}, ${state.postalCode} ${state.city}`, ++searchVersion.current)
  }

  const handleSelectBar = async (result: LocationSuggestion, addressOnly = false) => {
    if (loading) return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const version = ++searchVersion.current
    setLoading(true)
    setSearching(false)
    setStatus(null)
    try {
      const getDetails = httpsCallable<{ placeId: string; sessionToken: string }, { place: LocationDetails }>(functions, 'getRegistrationLocationDetails')
      if (!searchSession.current) throw new Error('Missing location search session')
      const { data: { place } } = await getDetails({ placeId: result.placeId, sessionToken: searchSession.current })
      if (version !== searchVersion.current) return
      setState(s => ({
        ...s, businessName: addressOnly ? s.businessName : place.name,
        address: addressOnly ? s.address : place.address,
        city: addressOnly ? s.city : place.city, postalCode: addressOnly ? s.postalCode : place.postalCode,
        location: { latitude: place.latitude, longitude: place.longitude }, googlePlaceId: place.placeId,
      }))
      searchSession.current = null
      setSearchResults([])
      setStep(4)
    } catch (error) {
      if (version === searchVersion.current) setStatus(getFriendlyFunctionError(error))
    } finally {
      setLoading(false)
    }
  }

  const locationResults = (addressOnly = false) => searchResults.length > 0 && (
    <div id="bar-suggestions" role="listbox" aria-label="Coincidències de locals"
      style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 12, border: '1px solid var(--border)', borderRadius: 14 }}>
      {searchResults.map((result, index) => (
        <button key={result.placeId} id={`bar-suggestion-${index}`} type="button" role="option"
          aria-selected={activeSuggestion === index} disabled={loading} onClick={() => handleSelectBar(result, addressOnly)}
          style={{ width: '100%', padding: '14px 16px', background: 'transparent', border: 'none',
            borderBottom: '1px solid var(--border)', cursor: loading ? 'wait' : 'pointer', textAlign: 'left', fontFamily: 'inherit',
            ...(activeSuggestion === index ? { background: formAccentSoft } : {}) }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
            {result.primaryText}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{result.secondaryText}</div>
        </button>
      ))}
    </div>
  )

  const validateBusinessDetails = () => {
    if (![state.businessName, state.address, state.city, state.postalCode, state.nif].every(value => value.trim())) {
      return 'Omple tots els camps obligatoris (*)'
    }
    if (!/^\d{5}$/.test(state.postalCode.trim())) return 'El codi postal ha de tenir 5 dígits.'
    if (!stdnum.ES.nif.validate(state.nif).isValid) return 'El NIF / CIF / NIE no és vàlid. Revisa el número i el dígit de control.'
    if (!state.location) return 'Localitza i confirma l’adreça del bar abans de continuar.'
    return null
  }

  const handleContinue = () => {
    const error = validateBusinessDetails()
    if (error) { setStatus(error); return }
    setState(s => ({ ...s, nif: stdnum.ES.nif.compact(s.nif) }))
    setStatus(null)
    setStep(5)
  }

  /* ── PAS 5: Enviar registre complet (Firebase Cloud Function) ────────── */
  const handleSubmit = async () => {
    const validationError = validateBusinessDetails()
    if (validationError) { setStatus(validationError); return }
    if (!state.acceptTerms) {
      setStatus('Has d\'acceptar les condicions abans de continuar.')
      return
    }
    setLoading(true)
    setStatus('Creant compte de bar...')
    try {
      const register = httpsCallable<Record<string, unknown>, { ok: boolean; barId?: string; message?: string }>(functions, 'registerBar')
      const { password: _pw, ...barData } = { ...state, nif: stdnum.ES.nif.compact(state.nif) }
      await auth.currentUser?.getIdToken(true)
      const result = await register(barData)

      if (result.data.ok && result.data.barId && auth.currentUser) {
        const user = auth.currentUser
        const token = await user.getIdTokenResult(true)
        const [owner, profile] = await Promise.all([
          getDocFromServer(doc(db, 'barOwners', user.uid)),
          getDocFromServer(doc(db, 'users', user.uid)),
        ])
        if (owner.data()?.barId !== result.data.barId || profile.data()?.role !== 'bar_owner' || !profile.data()?.ownedBars?.includes(result.data.barId)
          || token.claims.role !== 'bar_owner') {
          throw new Error("No s'ha pogut confirmar el perfil desat. Reintenta el registre sense crear un altre compte.")
        }
        setStep(6)
        setStatus(null)
      } else {
        setStatus('Error desconegut')
      }

    } catch (err: unknown) {
      setStatus(getFriendlyFunctionError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleCheckout = async () => {
    setLoading(true)
    setStatus(null)
    try {
      const checkout = httpsCallable<Record<string, unknown>, { url?: string }>(functions, 'createCheckoutSession')
      const origin = window.location.origin
      const result = await checkout({
        billingCycle: state.billing,
        successUrl: `${origin}/registra-bar?checkout=success`,
        cancelUrl: `${origin}/registra-bar?checkout=cancelled`,
      })
      if (!result.data.url || !/^https:\/\/checkout\.stripe\.com\//.test(result.data.url)) {
        throw new Error("No s'ha pogut obrir el pagament.")
      }
      window.location.assign(result.data.url)
    } catch (error) {
      setStatus(getFriendlyFunctionError(error, true))
    } finally {
      setLoading(false)
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER — Cada pas
  ═══════════════════════════════════════════════════════════════════════ */

  const cardStyle: React.CSSProperties = {
    background: 'var(--card)', padding: 'clamp(20px, 4vw, 36px)', borderRadius: 20,
    boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
    maxWidth: 480, margin: '0 auto', width: '100%',
    position: 'relative',
    border: '1px solid var(--hairline)',
  }

  /* Barra de progrés: 4 segments
     Steps 1-2 → seg 1 | Step 3 → seg 2 | Step 4 → seg 3 | Step 5 → seg 4 */
  const progressSegment = step <= 2 ? 1 : step === 3 ? 2 : step === 4 ? 3 : 4

  const progressBar = (
    <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
      {[1, 2, 3, 4].map(s => (
        <div
          key={s}
          style={{
            flex: 1, height: 4, borderRadius: 2,
            background: s <= progressSegment ? formAccent : 'var(--border)',
            transition: 'background 0.3s',
          }}
        />
      ))}
    </div>
  )

  const isError = status ? /error|inv[àa]lid|feble|incorrecte|obligatoris|acceptar|existeix|ja t[eé]/i.test(status) : false
  const statusMessage = status && (
    <div role="status" aria-live="polite" style={{
      color: isError ? '#d97a7a' : formAccent,
      fontWeight: 600, marginTop: 16, textAlign: 'center', fontSize: 14,
    }}>
      {status}
    </div>
  )

  /* ── PAS 1: Crear compte ──────────────────────────────────────────── */
  if (step === 1) {
    const canSubmit = email.trim() && isValidEmail(email) && (!existingAccount || existingAccount === 'password') && state.contactName.trim() && state.password.length >= 8
    return (
      <div className="contact-form-card" style={cardStyle}>
        {progressBar}
        <div style={{ textAlign: 'center', marginBottom: 36, paddingTop: 4 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 24, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
            Crea el teu compte
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginTop: 8, lineHeight: 1.5 }}>
            Registra&apos;t per donar d&apos;alta el teu bar. Si ja tens un compte, fes servir el mateix correu i contrasenya.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <label style={labelStyle}>
            Nom complet *
            <input
              value={state.contactName}
              onChange={set('contactName')}
              style={inputStyle}
              placeholder="Joan Garcia"
              autoFocus
            />
          </label>
          <label style={labelStyle}>
            Email *
            <input
              type="email"
              value={email}
              onChange={e => {
                emailCheckVersion.current++
                setCheckingEmail(false)
                setEmail(e.target.value)
                if (status) setStatus(null)
                if (existingAccount) setExistingAccount(null)
              }}
              onFocus={() => setEmailTouched(false)}
              onBlur={() => { setEmailTouched(true); checkEmailExists(email) }}
              style={{
                ...inputStyle,
                borderColor: (emailError || existingAccount) ? '#d97a7a' : 'var(--border)',
                boxShadow: (emailError || existingAccount) ? '0 0 0 3px rgba(217,122,122,0.12)' : undefined,
              }}
              placeholder="joan@barcanpunyetes.cat"
              autoComplete="email"
            />
            {emailError && (
              <span style={{ fontSize: 12, color: '#d97a7a', marginTop: 6, display: 'block' }}>
                Introdueix un email vàlid (p. ex. nom@domini.cat)
              </span>
            )}
            {!emailError && checkingEmail && (
              <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, display: 'block' }}>
                Comprovant disponibilitat…
              </span>
            )}
            {!emailError && existingAccountMessage && (
              <span style={{ fontSize: 12, color: '#d97a7a', marginTop: 6, display: 'block', lineHeight: 1.4 }}>
                {existingAccountMessage}
              </span>
            )}
          </label>
          <label style={labelStyle}>
            Contrasenya *
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={state.password}
                onChange={set('password')}
                style={{ ...inputStyle, paddingRight: 54 }}
                placeholder="Escriu la teva contrasenya"
                autoComplete="new-password"
                onKeyDown={e => e.key === 'Enter' && canSubmit && handleCreateAccount()}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: 11,
                  border: 'none',
                  background: 'transparent',
                  color: formAccent,
                  cursor: 'pointer',
                  padding: 2,
                  width: 28,
                  height: 28,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label={showPassword ? 'Amagar contrasenya' : 'Mostrar contrasenya'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2" />
                    <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c5.2 0 9.4 3.5 10.8 8-0.5 1.6-1.5 3.1-2.8 4.3" />
                    <path d="M6.2 6.2C4.6 7.5 3.4 9.1 2.8 12c1.4 4.5 5.6 8 10.8 8 2 0 3.9-0.5 5.5-1.4" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>
          <div style={{ marginTop: -4, position: 'relative' }}>
            <div style={{
              width: '100%',
              height: 8,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
              border: '1px solid var(--hairline)',
              cursor: 'help',
            }}
              onMouseEnter={() => setShowPasswordTips(true)}
              onMouseLeave={() => setShowPasswordTips(false)}
              onFocus={() => setShowPasswordTips(true)}
              onBlur={() => setShowPasswordTips(false)}
              tabIndex={0}
            >
              <div
                style={{
                  width: `${(passwordStrength.score / 5) * 100}%`,
                  height: '100%',
                  transition: 'width 0.25s ease',
                  background: 'linear-gradient(90deg, #5f5336 0%, #9e8754 55%, #c9ab72 100%)',
                }}
              />
            </div>
            {state.password && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                Seguretat: <strong style={{ color: formAccent }}>{passwordStrength.label}</strong>
              </p>
            )}
            {showPasswordTips && (
              <div style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 20,
                zIndex: 5,
                background: 'rgba(17,17,17,0.96)',
                border: `1px solid ${formAccentBorder}`,
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 12,
                lineHeight: 1.55,
                boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
              }}>
                <p style={{ margin: 0, color: 'var(--muted)' }}>
                  {'Tria una contrasenya de com a mínim '}
                  <strong style={{ color: passwordChecks.minLength ? formAccent : 'var(--text)' }}>8 caràcters</strong>
                  {' i, si pot ser, combina '}
                  <strong style={{ color: passwordChecks.hasUpper ? formAccent : 'var(--text)' }}>majúscules</strong>
                  {', '}
                  <strong style={{ color: passwordChecks.hasLower ? formAccent : 'var(--text)' }}>minúscules</strong>
                  {', '}
                  <strong style={{ color: passwordChecks.hasNumber ? formAccent : 'var(--text)' }}>números</strong>
                  {' i '}
                  <strong style={{ color: passwordChecks.hasSymbol ? formAccent : 'var(--text)' }}>símbols</strong>
                  {' per fer-la més segura.'}
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleCreateAccount}
          disabled={loading || !canSubmit}
          style={{
            ...buttonPrimary,
            marginTop: 24,
            opacity: loading || !canSubmit ? 0.5 : 1,
            cursor: loading || !canSubmit ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Connectant…' : 'Continuar'}
        </button>
        {statusMessage}
      </div>
    )
  }

  /* ── PAS 2: Esperant verificació d'email ──────────────────────────── */
  if (step === 2) {
    return (
      <div style={cardStyle}>
        {progressBar}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
            Revisa el teu correu
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginTop: 8, lineHeight: 1.5 }}>
            Confirma aquesta adreça per continuar amb l&apos;alta del bar:<br/>
            <strong style={{ color: 'var(--text)' }}>{email}</strong>
          </p>
        </div>

        <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
          Obre el missatge de troBar i prem el botó de confirmació.
          Aquesta pàgina continuarà automàticament quan el correu estigui confirmat.
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
          Si no el trobes, revisa el <strong>correu brossa</strong> o demana&apos;n un altre.
        </p>

        {/* Reenviar */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          {cooldown > 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              Reenviar en {cooldown}s
            </p>
          ) : (
            <button
              onClick={handleResendVerification}
              style={{
                background: 'none', border: 'none', color: formAccent,
                cursor: 'pointer', fontSize: 14, fontWeight: 600,
                textDecoration: 'underline', fontFamily: 'inherit',
              }}
            >
              Reenviar correu de verificació
            </button>
          )}
        </div>

        <button
          onClick={() => {
            auth.signOut()
            setStep(1)
            setStatus(null)
          }}
          style={{ ...buttonSecondary, marginTop: 16 }}
        >
          Canviar el correu
        </button>

        {statusMessage}
      </div>
    )
  }

  /* ── PAS 3: Cerca del bar ───────────────────────────────────────────── */
  if (step === 3) {
    return (
      <div style={{ ...cardStyle, maxWidth: 560 }}>
        {progressBar}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
            Troba el teu bar
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
            Busca el local pel nom i el municipi i selecciona&apos;l de la llista.
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>
            Si no hi apareix, podràs introduir-ne les dades manualment.
          </p>
        </div>

        {/* Search input */}
        <label style={labelStyle} htmlFor="bar-search">Nom del bar i municipi</label>
        <div className="contact-search-row" style={{ marginTop: 8, marginBottom: 12 }}>
          <input
            id="bar-search" role="combobox" aria-autocomplete="list" aria-controls="bar-suggestions"
            aria-expanded={searchResults.length > 0} aria-busy={searching || loading}
            aria-activedescendant={activeSuggestion >= 0 ? `bar-suggestion-${activeSuggestion}` : undefined}
            type="text"
            value={searchQuery}
            disabled={loading}
            onChange={e => {
              searchVersion.current++
              setSearchQuery(e.target.value)
              setSearchResults([])
              setActiveSuggestion(-1)
              setSearching(e.target.value.trim().length >= 3)
              setStatus(null)
            }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                if (searchResults.length) setActiveSuggestion(i => Math.max(0, Math.min(searchResults.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (searchResults.length) void handleSelectBar(searchResults[Math.max(0, activeSuggestion)])
              } else if (e.key === 'Escape') {
                if (searchTimer.current) clearTimeout(searchTimer.current)
                searchVersion.current++
                setSearchResults([])
                setActiveSuggestion(-1)
                setSearching(false)
              }
            }}
            style={{ ...inputStyle, marginTop: 0 }}
            placeholder="Ex.: Zurito, Terrassa"
            maxLength={200}
            autoFocus
          />
        </div>
        {(searching || loading) && <p role="status" style={{ fontSize: 13, color: 'var(--muted)' }}>
          {loading ? 'Carregant les dades del local…' : 'Cercant coincidències…'}
        </p>}
        {!searchQuery.trim() && <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Les coincidències apareixeran aquí mentre escrius.
        </p>}

        {/* Search results */}
        {locationResults()}
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          Resultats de <a href="https://maps.google.com" target="_blank" rel="noreferrer">Google Maps</a>.
        </p>
        {statusMessage}

        {/* Skip button */}
        <button
          disabled={loading}
          onClick={() => { searchVersion.current++; setSearchResults([]); setStep(4); setStatus(null) }}
          style={{
            ...buttonSecondary,
            marginTop: 4,
            textAlign: 'center',
            fontSize: 13,
          }}
        >
          Introduir les dades manualment
        </button>

      </div>
    )
  }

  /* ── PAS 4: Dades del negoci ────────────────────────────────────────── */
  if (step === 4) {
    return (
      <div style={{ ...cardStyle, maxWidth: 600 }}>
        {progressBar}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
            Dades del teu bar
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
            ✓ Email verificat: <strong>{email}</strong>
          </p>
        </div>

        <p style={sectionTitleStyle}>Dades del local</p>
        <div className="contact-step4-grid" style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Nom del local *
            <input required value={state.businessName} onChange={set('businessName')} style={inputStyle} placeholder="Bar Can Punyetes" />
          </label>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Adreça *
            <input required disabled={searching || loading} value={state.address} onChange={set('address')} style={inputStyle} placeholder="Carrer de Sants 123" />
          </label>
          <label style={labelStyle}>
            Ciutat *
            <input required disabled={searching || loading} value={state.city} onChange={set('city')} style={inputStyle} placeholder="Barcelona" />
          </label>
          <label style={labelStyle}>
            Codi postal *
            <input required disabled={searching || loading} value={state.postalCode} onChange={set('postalCode')} style={inputStyle} placeholder="08014" maxLength={5} />
          </label>
          <label style={labelStyle}>
            Telèfon del local
            <input value={state.phone} onChange={set('phone')} style={inputStyle} placeholder="93 123 45 67" type="tel" />
          </label>
          <label style={labelStyle}>
            Pàgina web
            <input value={state.website} onChange={set('website')} style={inputStyle} placeholder="https://..." type="url" />
          </label>
        </div>

        <button type="button" onClick={handleLocateAddress} disabled={searching || loading} style={buttonSecondary}>
          {searching ? 'Localitzant…' : state.location ? 'Tornar a localitzar l’adreça' : 'Localitza l’adreça al mapa'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          {state.location ? 'Ubicació seleccionada. Si canvies l’adreça, cal tornar-la a localitzar.' : 'Cerca l’adreça i selecciona el resultat correcte per situar el bar al mapa.'}
          {' '}Resultats de <a href="https://maps.google.com" target="_blank" rel="noreferrer">Google Maps</a>.
        </p>
        {locationResults(true)}

        <p style={{ ...sectionTitleStyle, marginTop: 28 }}>Dades legals</p>
        <div className="contact-step4-grid" style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
          <label style={labelStyle}>
            NIF / CIF / NIE *
            <input required value={state.nif} onChange={set('nif')} style={inputStyle} placeholder="NIF del titular o de la societat"
              maxLength={20} autoCapitalize="characters" spellCheck={false} aria-describedby="tax-id-help"
              onBlur={() => {
                const result = stdnum.ES.nif.validate(state.nif)
                if ('compact' in result && result.compact) {
                  const normalized = result.compact
                  setState(s => ({ ...s, nif: normalized }))
                }
              }} />
          </label>
          <label style={labelStyle}>
            Raó social
            <input value={state.legalName} onChange={set('legalName')} style={inputStyle} placeholder="Bar Can Punyetes S.L." />
          </label>
        </div>
        <p id="tax-id-help" style={{ fontSize: 12, color: 'var(--muted)' }}>
          Comprovem el format i el dígit de control. Aquesta validació no confirma l’alta censal ni la titularitat del negoci.
        </p>

        <p style={{ ...sectionTitleStyle, marginTop: 28 }}>Persona de contacte</p>
        <div className="contact-step4-grid" style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
          <label style={labelStyle}>
            Nom
            <input disabled value={state.contactName} style={{ ...inputStyle, background: 'var(--bg)', color: 'var(--muted)' }} />
          </label>
          <label style={labelStyle}>
            Telèfon de contacte
            <input value={state.contactPhone} onChange={set('contactPhone')} style={inputStyle} placeholder="600 123 456" type="tel" />
          </label>
        </div>

        <p style={{ ...sectionTitleStyle, marginTop: 28 }}>Detalls del local</p>
        <div className="contact-step4-grid" style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
          <label style={labelStyle}>
            Aforament (persones)
            <input value={state.capacity} onChange={set('capacity')} style={inputStyle} placeholder="80" type="number" min={1} />
          </label>
          <label style={labelStyle}>
            Nombre de pantalles
            <input value={state.screens} onChange={set('screens')} style={inputStyle} placeholder="4" type="number" min={0} />
          </label>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Horari d&apos;obertura
            <input value={state.openingHours} onChange={set('openingHours')} style={inputStyle} placeholder="Dl-Dv: 10-02h / Ds-Dg: 11-03h" />
          </label>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Descripció breu del local
            <textarea value={state.description} onChange={set('description')} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Bar de barri amb ambient futboler, tapes casolanes i bon rotllo..." maxLength={500} />
          </label>
        </div>

        <div className="contact-actions" style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <button
            onClick={() => { setStep(3); setStatus(null) }}
            style={{ ...buttonSecondary, flex: 1, marginTop: 0 }}
          >
            Enrere
          </button>
          <button
            onClick={handleContinue}
            style={{ ...buttonPrimary, flex: 2 }}
          >
            Continuar
          </button>
        </div>
        {statusMessage}
      </div>
    )
  }

  /* ── PAS 5: Facturació + confirmació ─────────────────────────────── */
  if (step === 5) {
    const sel = CYCLES[state.billing]
    const priceLabel = `${sel.price}€/mes`
    const totalLabel = state.billing === 'monthly'
      ? `${sel.price}€/mes`
      : state.billing === 'quarterly'
        ? `${sel.price * 3}€ cada 3 mesos`
        : `${sel.price * 12}€/any`

    return (
      <div style={cardStyle}>
        {progressBar}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
            Tria la facturació
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
            Un sol pla, tot inclòs. Estalvia triant trimestral o anual.
          </p>
        </div>

        {/* Billing cycle selector */}
        <div className="contact-billing-row" style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {(Object.keys(CYCLES) as BillingCycle[]).map(key => {
            const c = CYCLES[key]
            const active = state.billing === key
            return (
              <button
                key={key}
                onClick={() => setState(s => ({ ...s, billing: key }))}
                style={{
                  flex: 1, padding: '14px 8px', borderRadius: 12,
                  border: active ? `2px solid ${formAccent}` : '2px solid var(--border)',
                  background: active ? formAccentSoft : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{c.label}</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', marginTop: 4 }}>{c.price}€<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}>/mes</span></div>
                {c.saveYear && <div style={{ fontSize: 11, fontWeight: 700, color: formAccent, marginTop: 4 }}>Estalvia {c.saveYear}€/any</div>}
              </button>
            )
          })}
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
          Facturat com <strong style={{ color: 'var(--text)' }}>{totalLabel}</strong> · 14 dies de prova gratis
        </p>

        {/* Acceptació */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          cursor: 'pointer', fontSize: 13, color: 'var(--muted)', marginBottom: 20,
        }}>
          <input
            type="checkbox" checked={state.acceptTerms}
            onChange={set('acceptTerms') as unknown as React.ChangeEventHandler<HTMLInputElement>}
            style={{ marginTop: 2, width: 18, height: 18, accentColor: formAccent } as React.CSSProperties}
          />
          <span>
            He llegit i accepto les{' '}
            <button type="button" onClick={() => onOpenLegal?.('terms')} style={{
              color: formAccent, textDecoration: 'underline', background: 'none',
              border: 'none', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', padding: 0,
            }}>Condicions del Servei</button>
            {' '}i la{' '}
            <button type="button" onClick={() => onOpenLegal?.('privacy')} style={{
              color: formAccent, textDecoration: 'underline', background: 'none',
              border: 'none', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', padding: 0,
            }}>Política de Privacitat</button>.
          </span>
        </label>

        {/* Resum */}
        <div style={{
          background: 'rgba(0,0,0,0.02)', borderRadius: 12, padding: 16, marginBottom: 20,
          border: '1px solid var(--border)',
        }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>Resum</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
            <span style={{ color: 'var(--text)' }}>{state.businessName || '—'}</span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{priceLabel}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {state.address}{state.city ? `, ${state.city}` : ''} · {email}
          </div>
        </div>

        <div className="contact-actions" style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setStep(4)}
            style={{ ...buttonSecondary, flex: 1, marginTop: 0 }}
          >
            Enrere
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !state.acceptTerms}
            style={{
              ...buttonPrimary, flex: 2,
              opacity: loading || !state.acceptTerms ? 0.5 : 1,
              cursor: loading || !state.acceptTerms ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Processant…' : `Confirmar · ${priceLabel}`}
          </button>
        </div>
        {statusMessage}
      </div>
    )
  }

  /* ── PAS 6: Confirmació final ───────────────────────────────────────── */
  return (
    <div style={cardStyle}>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <h2 style={{ margin: 0, fontSize: 26, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
          Benvingut a troBar!
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 16, marginTop: 12, lineHeight: 1.6 }}>
          El teu bar <strong style={{ color: 'var(--text)' }}>{state.businessName}</strong> ha estat registrat correctament.
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>
          El registre s&apos;ha desat. La comprovació del NIF és de format i dígit de control, no censal. Cap pagament es confirma només amb una redirecció.
        </p>
        <p style={{ fontSize: 14 }}>
          {subscription?.active
            ? subscription.status === 'trialing' ? 'Subscripció en període de prova (confirmada pel servidor).' : 'Subscripció activa (confirmada pel servidor).'
            : 'La subscripció encara no està activa.'}
        </p>
        {!subscription?.active && (
          <button onClick={handleCheckout} disabled={loading} style={buttonPrimary}>
            {loading ? 'Obrint Stripe…' : 'Activar subscripció amb Stripe · 14 dies de prova'}
          </button>
        )}
        {statusMessage}

        <div style={{
          marginTop: 28, padding: 20, borderRadius: 14,
          background: formAccentSoft, border: `1px solid ${formAccentBorder}`,
        }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>
            Descarrega l&apos;app per gestionar el teu bar
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Inicia sessió amb <strong>{email}</strong> i la contrasenya que has creat.
          </p>
        </div>
      </div>
    </div>
  )
}
