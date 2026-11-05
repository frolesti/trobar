import { useState, useEffect, useRef } from 'react'
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, updateProfile, fetchSignInMethodsForEmail, onAuthStateChanged } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { doc, getDocFromServer } from 'firebase/firestore'
import { stdnum } from 'stdnum'
import { auth, db, functions } from '../lib/firebase'
import StoreBadges from './StoreBadges'

/* ═══════════════════════════════════════════════════════════════════════════
   ContactForm — Flux de registre en 6 passos
   ═══════════════════════════════════════════════════════════════════════════
   Pas 1: Email + contrasenya + nom → crear compte Firebase Auth → enviar verificació
   Pas 2: Esperar verificació d'email (polling automàtic)
   Pas 3: Cercar el bar (Google Places) → auto-omple dades
   Pas 4: Dades del negoci (pre-omplert si s'ha cercat)
   Pas 5: Selecció de facturació → esborrany pendent → Stripe Checkout
   Pas 6: Comprovació de subscripció o recuperació del pagament
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
  onStepChange?: (step: number) => void
}

interface SubscriptionStatus {
  active: boolean
  status?: string
  trialEnd?: number | null
  currentPeriodEnd?: number | null
  cancelAtPeriodEnd?: boolean
}

type FieldErrors = Partial<Record<keyof FormState | 'email', string>>

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
  if (!checkout && code === 'functions/failed-precondition') {
    return (error as { message?: string }).message || "No podem preparar l'alta. Revisa l'estat del teu compte."
  }
  return checkout
    ? "No hem pogut obrir Stripe. Hem guardat les dades perquè puguis reintentar-ho; el bar encara no està activat."
    : "No s'han pogut preparar les dades de l'alta. Torna-ho a provar amb el mateix compte."
}

/* ── Estils constants ─────────────────────────────────────────────────── */
const formAccent = 'var(--gold)'
const formAccentSoft = 'rgba(201,171,114,0.10)'
const formAccentBorder = 'rgba(201,171,114,0.28)'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', marginTop: 6, borderRadius: 12,
  border: '2px solid var(--border)', fontSize: 16, fontFamily: 'inherit',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box', background: '#fff', color: '#24211d',
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

export default function ContactForm({ onOpenLegal, onStepChange }: ContactFormProps) {
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
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const emailCheckVersion = useRef(0)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [errorAttempt, setErrorAttempt] = useState(0)
  const [checkingSubscription, setCheckingSubscription] = useState(false)
  const [subscriptionCheck, setSubscriptionCheck] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const previousStep = useRef(step)
  const resumeCheckout = useRef<'auto' | 'review' | null>(null)
  const checkoutRedirecting = useRef(false)
  const scrollBehavior = (): ScrollBehavior => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

  useEffect(() => { onStepChange?.(step) }, [step, onStepChange])

  useEffect(() => {
    if (previousStep.current === step) return
    previousStep.current = step
    const heading = cardRef.current?.querySelector('h2')
    heading?.setAttribute('tabindex', '-1')
    heading?.focus({ preventScroll: true })
    cardRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
  }, [step])

  useEffect(() => {
    if (!errorAttempt) return
    const field = cardRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    field?.focus({ preventScroll: true })
    field?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' })
  }, [errorAttempt, step])

  useEffect(() => {
    if (!status || loading || Object.values(fieldErrors).some(Boolean)) return
    const alert = cardRef.current?.querySelector<HTMLElement>('[role="alert"]')
    alert?.focus({ preventScroll: true })
    alert?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' })
  }, [status, loading])

  const showFieldErrors = (errors: FieldErrors) => {
    setFieldErrors(errors)
    setStatus('Revisa els camps destacats per continuar.')
    setErrorAttempt(attempt => attempt + 1)
  }

  const fieldProps = (field: keyof FormState | 'email', required = false) => ({
    id: `registration-${field}`,
    required,
    'aria-invalid': fieldErrors[field] ? true : undefined,
    'aria-describedby': fieldErrors[field] ? `registration-${field}-error` : undefined,
  })

  const fieldError = (field: keyof FormState | 'email') => fieldErrors[field] && (
    <span id={`registration-${field}-error`} className="registration-field-error">{fieldErrors[field]}</span>
  )

  const handleBackToAccount = async () => {
    setLoading(true)
    try {
      await auth.signOut()
      setStep(1)
      setState(s => ({ ...s, password: '' }))
      setStatus(null)
      setFieldErrors({})
    } catch {
      setStatus("No hem pogut tornar al compte. Comprova la connexió i torna-ho a provar.")
    } finally {
      setLoading(false)
    }
  }

  const handleBackToPage = () => {
    if (window.history.length > 1) window.history.back()
    else window.location.assign('/per-a-bars')
  }

  const restoreOwnerDetails = async (data: Record<string, unknown>, uid: string) => {
    const profile = await getDocFromServer(doc(db, 'users', uid))
    const user = auth.currentUser
    const token = await user?.getIdTokenResult()
    if (profile.data()?.role !== 'bar_owner' || !profile.data()?.ownedBars?.includes(data.barId)
      || token?.claims.role !== 'bar_owner') {
      setStep(3)
      return
    }
    const bar = typeof data.barId === 'string' ? await getDocFromServer(doc(db, 'bars', data.barId)) : null
    const details = bar?.data()
    setState(s => ({
      ...s, password: '', businessName: typeof data.barName === 'string' ? data.barName : '',
      contactName: typeof data.name === 'string' ? data.name : s.contactName,
      billing: typeof data.billingCycle === 'string' && data.billingCycle in CYCLES ? data.billingCycle as BillingCycle : 'quarterly',
      ...(details ? {
        address: details.address || '', city: details.city || '', postalCode: details.postalCode || '',
        phone: details.phone || '', website: details.website || '', location: details.location || null,
        googlePlaceId: details.googlePlaceId || null, nif: typeof data.nif === 'string' ? data.nif : '',
        legalName: typeof data.legalName === 'string' ? data.legalName : '',
        contactPhone: typeof data.phone === 'string' ? data.phone : '',
        capacity: details.capacity == null ? '' : String(details.capacity),
        screens: details.screens == null ? '' : String(details.screens),
        openingHours: details.openingHours || '', description: details.description || '',
      } : {}),
    }))
    const checkoutReturn = new URLSearchParams(window.location.search).get('checkout')
    resumeCheckout.current = details && (details.status === 'pending_checkout' || !data.stripeSubscriptionId)
      ? checkoutReturn === 'cancelled' ? 'review' : !checkoutReturn ? 'auto' : null
      : null
    setCheckingSubscription(true)
    setStep(6)
  }

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
        await restoreOwnerDetails(owner.data(), user.uid)
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
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    setCheckingSubscription(true)
    const check = httpsCallable<Record<string, never>, SubscriptionStatus>(functions, 'getSubscriptionStatus')
    const refresh = async () => {
      try {
        const result = await check({})
        if (cancelled) return
        setSubscription(result.data)
        const canResume = !result.data.active && (!result.data.status || ['canceled', 'incomplete_expired'].includes(result.data.status))
        if (canResume && resumeCheckout.current) {
          const action = resumeCheckout.current
          resumeCheckout.current = null
          setStatus(null)
          if (action === 'review') {
            setStep(5)
          } else {
            setLoading(true)
            try {
              await openCheckout()
            } catch (error) {
              if (!cancelled) setStatus(getFriendlyFunctionError(error, true))
            } finally {
              if (!cancelled && !checkoutRedirecting.current) setLoading(false)
            }
          }
          if (!cancelled) setCheckingSubscription(false)
          return
        }
        const returning = new URLSearchParams(window.location.search).get('checkout') === 'success'
        if (!result.data.active && returning && ++attempts < 10) {
          timer = setTimeout(() => { void refresh() }, 3000)
          return
        }
        setStatus(result.data.active ? null : returning
          ? "Stripe encara està confirmant el pagament. Torna-ho a comprovar."
          : null)
      } catch {
        if (!cancelled) setStatus("No hem pogut comprovar la subscripció. Torna-ho a comprovar abans de repetir el pagament.")
      }
      if (!cancelled) setCheckingSubscription(false)
    }
    void refresh()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [step, subscriptionCheck])

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
    setFieldErrors(errors => ({ ...errors, [key]: undefined, ...(changesAddress ? { location: undefined } : {}) }))
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

    const errors: FieldErrors = {}
    if (!name) errors.contactName = 'Escriu el teu nom.'
    if (!isValidEmail(normalizedEmail)) errors.email = 'Introdueix un email vàlid.'
    if (pwd.length < 8) errors.password = 'La contrasenya ha de tenir com a mínim 8 caràcters.'
    if (Object.keys(errors).length) { showFieldErrors(errors); return }
    if (existingAccount && existingAccount !== 'password') {
      return
    }
    setFieldErrors({})
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
          await restoreOwnerDetails(owner.data(), userCred.user.uid)
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
    const errors: FieldErrors = {}
    if (!state.address.trim()) errors.address = 'Escriu l’adreça del local.'
    if (!state.city.trim()) errors.city = 'Escriu el municipi.'
    if (!/^\d{5}$/.test(state.postalCode.trim())) errors.postalCode = 'Introdueix un codi postal de 5 dígits.'
    if (Object.keys(errors).length) { showFieldErrors(errors); return }
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
      setFieldErrors(errors => ({ ...errors, location: undefined }))
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
    const errors: FieldErrors = {}
    if (!state.businessName.trim()) errors.businessName = 'Escriu el nom del local.'
    if (!state.address.trim()) errors.address = 'Escriu l’adreça del local.'
    if (!state.city.trim()) errors.city = 'Escriu el municipi.'
    if (!/^\d{5}$/.test(state.postalCode.trim())) errors.postalCode = 'Introdueix un codi postal de 5 dígits.'
    if (!stdnum.ES.nif.validate(state.nif).isValid) errors.nif = 'Revisa el NIF: el número o el dígit de control no és correcte.'
    if (!state.contactName.trim()) errors.contactName = 'Escriu el nom de la persona de contacte.'
    if (!state.location) errors.location = 'Localitza l’adreça i selecciona una coincidència per confirmar-la.'
    for (const field of ['capacity', 'screens'] as const) {
      if (state[field].trim() && (!Number.isInteger(Number(state[field])) || Number(state[field]) < 0 || Number(state[field]) > 100000)) {
        errors[field] = 'Introdueix un nombre enter entre 0 i 100.000.'
      }
    }
    if (state.website.trim()) {
      try {
        const url = new URL(state.website)
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error('protocol')
      } catch {
        errors.website = 'Introdueix una adreça web completa, com https://elteubar.cat.'
      }
    }
    return errors
  }

  const handleContinue = () => {
    const errors = validateBusinessDetails()
    if (Object.keys(errors).length) { showFieldErrors(errors); return }
    setState(s => ({ ...s, nif: stdnum.ES.nif.compact(s.nif) }))
    setFieldErrors({})
    setStatus(null)
    setStep(5)
  }

  /* ── PAS 5: Enviar registre complet (Firebase Cloud Function) ────────── */
  const handleSubmit = async () => {
    const errors = validateBusinessDetails()
    if (Object.keys(errors).length) { setStep(4); showFieldErrors(errors); return }
    if (!state.acceptTerms) {
      showFieldErrors({ acceptTerms: 'Accepta les condicions i la política de privacitat per continuar a Stripe.' })
      return
    }
    setFieldErrors({})
    setLoading(true)
    setStatus(null)
    let prepared = false
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
        prepared = true
        await openCheckout()
      } else {
        throw new Error('Registration preparation did not return a bar')
      }

    } catch (err: unknown) {
      setStatus(getFriendlyFunctionError(err, prepared))
    } finally {
      if (!checkoutRedirecting.current) setLoading(false)
    }
  }

  const openCheckout = async () => {
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
    checkoutRedirecting.current = true
  }

  const handleCheckout = async () => {
    setLoading(true)
    setStatus(null)
    try {
      await openCheckout()
    } catch (error) {
      setStatus(getFriendlyFunctionError(error, true))
    } finally {
      if (!checkoutRedirecting.current) setLoading(false)
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER — Cada pas
  ═══════════════════════════════════════════════════════════════════════ */

  const cardStyle: React.CSSProperties = {
    background: 'var(--card)', padding: 'clamp(18px, 3vw, 28px)', borderRadius: 20,
    boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
    maxWidth: 480, margin: '0 auto', width: '100%',
    position: 'relative',
    border: '1px solid var(--hairline)',
  }

  const backButton = (onClick: () => void, label: string, disabled = loading) => disabled ? null : (
    <button type="button" onClick={onClick} aria-label={label} title={label} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 44, height: 44, marginBottom: 16, padding: 0, borderRadius: '50%',
      background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
  )

  /* Barra de progrés: 4 segments
     Steps 1-2 → seg 1 | Step 3 → seg 2 | Step 4 → seg 3 | Step 5 → seg 4 */
  const progressSegment = step <= 2 ? 1 : step === 3 ? 2 : step === 4 ? 3 : 4

  const progressBar = (
    <div className="registration-progress" role="group" aria-label={`Pas ${progressSegment} de 4: ${['Compte', 'Cerca del bar', 'Dades del bar', 'Subscripció'][progressSegment - 1]}`}>
      <p className="registration-step-label">Pas {progressSegment} de 4 · {['Compte', 'Cerca del bar', 'Dades del bar', 'Subscripció'][progressSegment - 1]}</p>
      <div aria-hidden="true" style={{ display: 'flex', gap: 6 }}>
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
    </div>
  )

  const isError = status !== null && !loading
  const statusMessage = status && (
    <div role={isError ? 'alert' : 'status'} tabIndex={-1} aria-live={isError ? 'assertive' : 'polite'} style={{
      color: isError ? '#d97a7a' : formAccent,
      fontWeight: 600, marginTop: 16, textAlign: 'center', fontSize: 14,
    }}>
      {status}
    </div>
  )

  /* ── PAS 1: Crear compte ──────────────────────────────────────────── */
  if (step === 1) {
    const canSubmit = !existingAccount || existingAccount === 'password'
    return (
      <div ref={cardRef} className="contact-form-card registration-form" style={cardStyle}>
        {backButton(handleBackToPage, 'Tornar a la pàgina anterior')}
        <div style={{ textAlign: 'center', marginBottom: 36, paddingTop: 4 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 24, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
            Crea el teu compte
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginTop: 8, lineHeight: 1.5 }}>
            Registra&apos;t per donar d&apos;alta el teu bar. Si ja tens un compte, fes servir el mateix correu i contrasenya.
          </p>
        </div>
        <p className="registration-field-guide">Els camps amb * són obligatoris.</p>

        <div style={{ display: 'grid', gap: 14 }}>
          <label style={labelStyle}>
            Nom complet *
            <input
              {...fieldProps('contactName', true)}
              value={state.contactName}
              onChange={set('contactName')}
              style={inputStyle}
              placeholder="Joan Garcia"
              autoFocus
            />
            {fieldError('contactName')}
          </label>
          <label style={labelStyle}>
            Email *
            <input
              {...fieldProps('email', true)}
              type="email"
              value={email}
              onChange={e => {
                emailCheckVersion.current++
                setCheckingEmail(false)
                setEmail(e.target.value)
                setFieldErrors(errors => ({ ...errors, email: undefined }))
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
            {fieldError('email')}
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
                {...fieldProps('password', true)}
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
            {fieldError('password')}
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
        {progressBar}
      </div>
    )
  }

  /* ── PAS 2: Esperant verificació d'email ──────────────────────────── */
  if (step === 2) {
    return (
      <div ref={cardRef} className="registration-form" style={cardStyle}>
        {backButton(handleBackToAccount, 'Tornar al compte')}
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

        {statusMessage}
        {progressBar}
      </div>
    )
  }

  /* ── PAS 3: Cerca del bar ───────────────────────────────────────────── */
  if (step === 3) {
    return (
      <div ref={cardRef} className="registration-form" style={{ ...cardStyle, maxWidth: 560 }}>
        {backButton(handleBackToAccount, 'Tornar al compte')}
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
        {progressBar}
      </div>
    )
  }

  /* ── PAS 4: Dades del negoci ────────────────────────────────────────── */
  if (step === 4) {
    return (
      <div ref={cardRef} className="registration-form" style={{ ...cardStyle, maxWidth: 600 }}>
        {backButton(() => { setStep(3); setStatus(null); setFieldErrors({}) }, 'Tornar a la cerca del bar', searching || loading)}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
            Dades del teu bar
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
            ✓ Email verificat: <strong>{email}</strong>
          </p>
        </div>
        <p className="registration-field-guide">Els camps amb * són obligatoris. La resta són opcionals.</p>

        <p style={sectionTitleStyle}>Dades del local</p>
        <div className="contact-step4-grid" style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Nom del local *
            <input {...fieldProps('businessName', true)} value={state.businessName} onChange={set('businessName')} style={inputStyle} placeholder="Bar Can Punyetes" maxLength={250} />
            {fieldError('businessName')}
          </label>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Adreça *
            <input {...fieldProps('address', true)} disabled={searching || loading} value={state.address} onChange={set('address')} style={inputStyle} placeholder="Carrer de Sants 123" maxLength={250} />
            {fieldError('address')}
          </label>
          <label style={labelStyle}>
            Ciutat *
            <input {...fieldProps('city', true)} disabled={searching || loading} value={state.city} onChange={set('city')} style={inputStyle} placeholder="Barcelona" maxLength={250} />
            {fieldError('city')}
          </label>
          <label style={labelStyle}>
            Codi postal *
            <input {...fieldProps('postalCode', true)} disabled={searching || loading} value={state.postalCode} onChange={set('postalCode')} style={inputStyle} placeholder="08014" maxLength={5} inputMode="numeric" />
            {fieldError('postalCode')}
          </label>
          <label style={labelStyle}>
            Telèfon del local <span className="registration-optional">(opcional)</span>
            <input value={state.phone} onChange={set('phone')} style={inputStyle} placeholder="93 123 45 67" type="tel" />
          </label>
          <label style={labelStyle}>
            Pàgina web <span className="registration-optional">(opcional)</span>
            <input {...fieldProps('website')} value={state.website} onChange={set('website')} style={inputStyle} placeholder="https://..." type="url" />
            {fieldError('website')}
          </label>
        </div>

        <p style={{ ...labelStyle, marginTop: 20, marginBottom: 0 }}>Ubicació al mapa *</p>
        <button {...fieldProps('location')} type="button" onClick={handleLocateAddress} disabled={searching || loading} style={buttonSecondary}>
          {searching ? 'Localitzant…' : state.location ? 'Tornar a localitzar l’adreça' : 'Localitza l’adreça al mapa'}
        </button>
        {fieldError('location')}
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          {state.location ? 'Ubicació seleccionada. Si canvies l’adreça, cal tornar-la a localitzar.' : 'Cerca l’adreça i selecciona el resultat correcte per situar el bar al mapa.'}
          {' '}Resultats de <a href="https://maps.google.com" target="_blank" rel="noreferrer">Google Maps</a>.
        </p>
        {locationResults(true)}

        <p style={{ ...sectionTitleStyle, marginTop: 28 }}>Dades legals</p>
        <div className="contact-step4-grid" style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
          <label style={labelStyle}>
            NIF del titular o de la societat *
            <input {...fieldProps('nif', true)} value={state.nif} onChange={set('nif')} style={inputStyle} placeholder="Ex.: B12345674"
              maxLength={20} autoCapitalize="characters" spellCheck={false}
              onBlur={() => {
                const result = stdnum.ES.nif.validate(state.nif)
                if ('compact' in result && result.compact) {
                  const normalized = result.compact
                  setState(s => ({ ...s, nif: normalized }))
                }
              }} />
            {fieldError('nif')}
          </label>
          <label style={labelStyle}>
            Raó social <span className="registration-optional">(opcional)</span>
            <input value={state.legalName} onChange={set('legalName')} style={inputStyle} placeholder="Bar Can Punyetes S.L." />
          </label>
        </div>
        <p style={{ ...sectionTitleStyle, marginTop: 28 }}>Persona de contacte</p>
        <div className="contact-step4-grid" style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
          <label style={labelStyle}>
            Nom *
            <input {...fieldProps('contactName', true)} value={state.contactName} onChange={set('contactName')} style={inputStyle} autoComplete="name" />
            {fieldError('contactName')}
          </label>
          <label style={labelStyle}>
            Telèfon de contacte <span className="registration-optional">(opcional)</span>
            <input value={state.contactPhone} onChange={set('contactPhone')} style={inputStyle} placeholder="600 123 456" type="tel" />
          </label>
        </div>

        <p style={{ ...sectionTitleStyle, marginTop: 28 }}>Detalls del local</p>
        <p className="registration-benefit">
          Ajuda els aficionats a triar el teu bar: explica l’ambient, quantes pantalles tens i quan obres.
          Un perfil complet els dona més motius per venir. Pots afegir aquests detalls ara o més endavant.
        </p>
        <div className="contact-step4-grid" style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
          <label style={labelStyle}>
            Aforament (persones) <span className="registration-optional">(opcional)</span>
            <input {...fieldProps('capacity')} value={state.capacity} onChange={set('capacity')} style={inputStyle} placeholder="80" type="number" min={0} max={100000} step={1} />
            {fieldError('capacity')}
          </label>
          <label style={labelStyle}>
            Nombre de pantalles <span className="registration-optional">(opcional)</span>
            <input {...fieldProps('screens')} value={state.screens} onChange={set('screens')} style={inputStyle} placeholder="4" type="number" min={0} max={100000} step={1} />
            {fieldError('screens')}
          </label>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Horari d&apos;obertura <span className="registration-optional">(opcional)</span>
            <input value={state.openingHours} onChange={set('openingHours')} style={inputStyle} placeholder="Dl-Dv: 10-02h / Ds-Dg: 11-03h" />
          </label>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Descripció breu del local <span className="registration-optional">(opcional)</span>
            <textarea value={state.description} onChange={set('description')} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Bar de barri amb ambient futboler, tapes casolanes i bon rotllo..." maxLength={500} />
          </label>
        </div>

        <div className="contact-actions" style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <button
            onClick={handleContinue}
            disabled={searching || loading}
            style={{ ...buttonPrimary, flex: 2 }}
          >
            Continuar: subscripció
          </button>
        </div>
        {statusMessage}
        {progressBar}
      </div>
    )
  }

  /* ── PAS 5: Facturació + confirmació ─────────────────────────────── */
  if (step === 5) {
    const sel = CYCLES[state.billing]
    const totalLabel = state.billing === 'monthly'
      ? `${sel.price}€/mes`
      : state.billing === 'quarterly'
        ? `${sel.price * 3}€ cada 3 mesos`
        : `${sel.price * 12}€/any`

    return (
      <div ref={cardRef} className="registration-form" style={cardStyle}>
        {backButton(() => { setStep(4); setStatus(null); setFieldErrors({}) }, 'Tornar a les dades del bar')}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
            Tria la facturació
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
            Un sol pla, tot inclòs. Estalvia triant trimestral o anual.
          </p>
          <p className="registration-benefit">
            Stripe és la passarel·la de pagament segura que fem servir per gestionar la targeta i els cobraments.
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
                disabled={loading}
                aria-pressed={active}
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
            {...fieldProps('acceptTerms', true)}
            type="checkbox" checked={state.acceptTerms}
            disabled={loading}
            onChange={set('acceptTerms')}
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
            }}>Política de Privacitat</button>. *
          </span>
        </label>
        {fieldError('acceptTerms')}

        {/* Resum */}
        <div style={{
          background: 'rgba(0,0,0,0.02)', borderRadius: 12, padding: 16, marginBottom: 20,
          border: '1px solid var(--border)',
        }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>Resum</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
            <span style={{ color: 'var(--text)' }}>{state.businessName || '—'}</span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{totalLabel}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {state.address}{state.city ? `, ${state.city}` : ''} · {email}
          </div>
        </div>

        <div className="contact-actions" style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleSubmit}
            disabled={loading}
            aria-busy={loading}
            aria-live="polite"
            style={{
              ...buttonPrimary, flex: 2,
              opacity: loading ? 0.5 : 1,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Obrint Stripe…' : 'Continuar a Stripe'}
          </button>
        </div>
        {statusMessage}
        {progressBar}
      </div>
    )
  }

  /* ── PAS 6: Confirmació final ───────────────────────────────────────── */
  const billingTimestamp = subscription?.status === 'trialing' ? subscription.trialEnd : subscription?.currentPeriodEnd
  const billingDate = typeof billingTimestamp === 'number' && billingTimestamp > 0
    && Number.isFinite(new Date(billingTimestamp * 1000).getTime())
    ? new Intl.DateTimeFormat('ca-ES', { dateStyle: 'long', timeZone: 'Europe/Madrid' }).format(new Date(billingTimestamp * 1000))
    : null
  const checkoutSucceeded = new URLSearchParams(window.location.search).get('checkout') === 'success'
  return (
    <div ref={cardRef} className="registration-form registration-confirmation" style={cardStyle} aria-busy={loading || checkingSubscription}>
      {!subscription?.active && !checkingSubscription && !checkoutSucceeded &&
        backButton(() => { setStep(5); setStatus(null); setFieldErrors({}) }, 'Tornar a la subscripció')}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 26, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
          {loading ? 'Obrint Stripe…' : checkingSubscription ? 'Confirmant…'
            : subscription?.active ? 'El teu bar ja està activat!'
            : 'Continua amb Stripe'}
        </h2>
        {subscription?.active && !checkingSubscription && (
        <p style={{ color: 'var(--muted)', fontSize: 16, marginTop: 12, lineHeight: 1.6 }}>
          La subscripció de <strong style={{ color: 'var(--text)' }}>{state.businessName}</strong> està confirmada.
        </p>
        )}
        {subscription?.active && !checkingSubscription && (
          <p style={{ fontSize: 14 }}>
            El teu bar ja apareix com a Premium al mapa de troBar.
          </p>
        )}
        {subscription?.active && !checkingSubscription && (
          <div className="registration-billing-details">
            {billingDate ? (
              <>
                <p>
                  {subscription.cancelAtPeriodEnd ? 'Tens accés fins al ' : subscription.status === 'trialing' ? 'Primer cobrament: ' : 'Pròxima renovació: '}
                  <strong>{billingDate}</strong>.
                </p>
                <p>
                  {subscription.cancelAtPeriodEnd ? 'La renovació està cancel·lada. No es farà cap cobrament.'
                    : 'El cobrament és automàtic si no cancel·les abans d’aquesta data. Stripe gestiona el pagament de forma segura.'}
                </p>
              </>
            ) : (
              <p>La data de cobrament encara no està disponible.
                {' '}<button type="button" onClick={() => setSubscriptionCheck(value => value + 1)} className="registration-inline-action">Tornar a comprovar</button>
              </p>
            )}
          </div>
        )}
        {!subscription?.active && !checkingSubscription && !loading && (
          <>
            {subscription && (!subscription.status || ['canceled', 'incomplete_expired'].includes(subscription.status))
              && new URLSearchParams(window.location.search).get('checkout') !== 'success' ? (
                <button onClick={handleCheckout} disabled={loading} style={buttonPrimary}>
                  Continuar a Stripe
                </button>
              ) : (
                <button onClick={() => { setStatus(null); setSubscriptionCheck(value => value + 1) }} style={buttonSecondary}>
                  Comprovar confirmació
                </button>
            )}
            {subscription?.status && !['canceled', 'incomplete_expired'].includes(subscription.status) && (
              <p>Contacta amb suport per revisar el pagament.</p>
            )}
          </>
        )}
        {statusMessage}

        {subscription?.active && !checkingSubscription && (
        <div style={{
          marginTop: 16, padding: 16, borderRadius: 14,
          background: formAccentSoft, border: `1px solid ${formAccentBorder}`,
        }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>
            Gestiona el teu bar des de l&apos;app
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Inicia sessió amb <strong>{email}</strong> i la contrasenya que has creat.
          </p>
          <StoreBadges center />
        </div>
        )}
      </div>
    </div>
  )
}
