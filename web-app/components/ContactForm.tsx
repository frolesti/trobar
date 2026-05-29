import { useState, useEffect } from 'react'
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, updateProfile, fetchSignInMethodsForEmail, deleteUser } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../lib/firebase'
import Logo from './Logo'

/* ═══════════════════════════════════════════════════════════════════════════
   ContactForm — Flux de registre en 6 passos
   ═══════════════════════════════════════════════════════════════════════════
   Pas 1: Email + contrasenya + nom → crear compte Firebase Auth → enviar verificació
   Pas 2: Esperar verificació d'email (polling automàtic)
   Pas 3: Cercar el bar (Nominatim / OSM) → auto-omple dades
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

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address?: {
    amenity?: string
    road?: string
    house_number?: string
    city?: string
    town?: string
    village?: string
    postcode?: string
    [key: string]: string | undefined
  }
}

interface FormState {
  /* Dades del local */
  businessName: string
  address: string
  city: string
  postalCode: string
  phone: string
  website: string
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
    case 'auth/operation-not-allowed':
      return 'El registre amb email/contrasenya no està habilitat al projecte Firebase.'
    case 'auth/too-many-requests':
      return 'Massa intents seguits. Espera uns minuts i torna-ho a provar.'
    case 'auth/network-request-failed':
      return 'Error de connexió. Comprova internet i torna-ho a provar.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Contrasenya incorrecta per aquest email.'
    default:
      return fbErr.message || 'No s\'ha pogut completar el registre ara mateix.'
  }
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

const stepBadge: React.CSSProperties = {
  width: 64,
  height: 64,
  margin: '0 auto 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
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

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
  const emailError = (emailTouched || email.trim().length >= 6) && email.trim() !== '' && !isValidEmail(email)

  const checkEmailExists = async (rawEmail: string) => {
    const value = rawEmail.trim().toLowerCase()
    if (!isValidEmail(value)) return
    setCheckingEmail(true)
    try {
      const methods = await fetchSignInMethodsForEmail(auth, value)
      if (methods.includes('password')) setExistingAccount('password')
      else if (methods.includes('google.com')) setExistingAccount('google.com')
      else if (methods.includes('apple.com')) setExistingAccount('apple.com')
      else if (methods.length > 0) setExistingAccount('other')
      else setExistingAccount(null)
    } catch {
      // Si Firebase té protecció anti-enumeration, ho detectarem en el submit.
    } finally {
      setCheckingEmail(false)
    }
  }

  const existingAccountMessage = (() => {
    switch (existingAccount) {
      case 'password':
        return 'Ja existeix un compte amb aquest email. Fes servir un altre email per registrar el bar.'
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
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)

  /* ── Cooldown timer ────────────────────────────────────────────────── */
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setState(s => ({ ...s, [key]: (e.target as HTMLInputElement).type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

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
    if (existingAccount) {
      return
    }
    if (pwd.length < 8) {
      setStatus('La contrasenya ha de tenir mínim 8 caràcters')
      return
    }

    setLoading(true)
    setStatus(null)

    try {
      // 1. Comprovar si l'email ja existeix
      let methods: string[] = []
      try {
        methods = await fetchSignInMethodsForEmail(auth, normalizedEmail)
      } catch {
        // Si Firebase té protecció anti-enumeration ho captarem al createUser.
      }

      if (methods.includes('password')) {
        setExistingAccount('password')
        return
      }
      if (methods.includes('google.com')) {
        setExistingAccount('google.com')
        return
      }
      if (methods.includes('apple.com')) {
        setExistingAccount('apple.com')
        return
      }
      if (methods.length > 0) {
        setExistingAccount('other')
        return
      }

      let userCred
      try {
        userCred = await createUserWithEmailAndPassword(auth, normalizedEmail, pwd)
      } catch (err: unknown) {
        const fbErr = err as { code?: string; message?: string }
        if (fbErr.code === 'auth/email-already-in-use') {
          setExistingAccount('password')
          return
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
        await updateProfile(userCred.user, { displayName: name })
        await sendEmailVerification(userCred.user)
      }

      setStep(2)
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
        await user.reload()
        if (user.emailVerified) {
          setStep(3)
          setStatus(null)
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

  /* ── PAS 3: Cercar bar al mapa (Nominatim / OSM) ───────────────────── */
  const handleSearchBar = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchResults([])
    setStatus(null)

    try {
      const q = encodeURIComponent(searchQuery.trim())
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&addressdetails=1&limit=6&countrycodes=es`,
        { headers: { 'Accept-Language': 'ca', 'User-Agent': 'troBar/1.0' } }
      )
      const data: NominatimResult[] = await res.json()
      setSearchResults(data)
      if (data.length === 0) {
        setStatus('No hem trobat resultats. Prova amb un altre nom o adreça.')
      }
    } catch {
      setStatus('Error cercant. Prova de nou.')
    } finally {
      setSearching(false)
    }
  }

  const handleSelectBar = (result: NominatimResult) => {
    const addr = result.address || {}
    const streetParts = [addr.road, addr.house_number].filter(Boolean).join(' ')

    setState(s => ({
      ...s,
      businessName: addr.amenity || result.display_name.split(',')[0] || s.businessName,
      address: streetParts || s.address,
      city: addr.city || addr.town || addr.village || s.city,
      postalCode: addr.postcode || s.postalCode,
    }))
    setStep(4)
    setStatus(null)
  }

  /* ── PAS 5: Enviar registre complet (Firebase Cloud Function) ────────── */
  const handleSubmit = async () => {
    if (!state.acceptTerms) {
      setStatus('Has d\'acceptar les condicions abans de continuar.')
      return
    }
    setLoading(true)
    setStatus('Creant compte de bar...')
    try {
      const register = httpsCallable<Record<string, unknown>, { ok: boolean; barId?: string; message?: string }>(functions, 'registerBar')
      const { password: _pw, ...barData } = state
      const result = await register(barData)

      if (result.data.ok) {
        setStep(6)
        setStatus(null)
      } else {
        setStatus('Error desconegut')
      }
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'Error de connexió'
      setStatus(message.replace(/^.*?:\s*/, '') || 'Error creant el compte')
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
    <div style={{
      color: isError ? '#d97a7a' : formAccent,
      fontWeight: 600, marginTop: 16, textAlign: 'center', fontSize: 14,
    }}>
      {status}
    </div>
  )

  /* ── PAS 1: Crear compte ──────────────────────────────────────────── */
  if (step === 1) {
    const canSubmit = email.trim() && isValidEmail(email) && !existingAccount && state.contactName.trim() && state.password.length >= 8
    return (
      <div style={cardStyle}>
        {progressBar}
        <div style={{ textAlign: 'center', marginBottom: 36, paddingTop: 4 }}>
          <div style={{ ...stepBadge, width: 84, height: 84, marginBottom: 18 }}>
            <Logo size={84} variant="white" visualScale={1.65} maskCircle={false} />
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 24, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
            Crea el teu compte
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginTop: 8, lineHeight: 1.5 }}>
            Introdueix les teves dades i verificarem el teu email automàticament.
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
                setEmail(e.target.value)
                if (status) setStatus(null)
                if (existingAccount) setExistingAccount(null)
              }}
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
          {loading ? 'Creant compte…' : 'Crear compte'}
        </button>
        <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', marginTop: 10, lineHeight: 1.4 }}>
          Rebràs un correu per verificar el teu email.<br/>
          Un cop verificat, podràs continuar amb el registre.
        </p>
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
          <div style={stepBadge}>
            <Logo size={56} variant="white" visualScale={1.08} maskCircle={false} />
          </div>
          <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
            Verifica el teu email
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginTop: 8, lineHeight: 1.5 }}>
            Hem enviat un correu de verificació a<br/>
            <strong style={{ color: 'var(--text)' }}>{email}</strong>
          </p>
        </div>

        {/* Animació d'espera */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-block', width: 48, height: 48, borderRadius: '50%',
            border: '3px solid var(--border)', borderTopColor: formAccent,
            animation: 'spin 1s linear infinite',
          }} />
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 12 }}>
            Esperant verificació…
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>

        <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
          Clica l&apos;enllaç del correu per verificar el teu email.<br/>
          No el trobes? Revisa la carpeta de <strong>correu brossa</strong>.
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
          ← Canviar email
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
          <div style={stepBadge}>
            <Logo size={56} variant="white" visualScale={1.08} maskCircle={false} />
          </div>
          <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
            Troba el teu bar
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
            ✓ Email verificat: <strong>{email}</strong>
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>
            Cerca el nom o l&apos;adreça del teu bar per auto-omplir les dades.
          </p>
        </div>

        {/* Search input */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearchBar()}
            style={{ ...inputStyle, marginTop: 0, flex: 1 }}
            placeholder="Bar Can Punyetes, Barcelona"
            autoFocus
          />
          <button
            onClick={handleSearchBar}
            disabled={searching || !searchQuery.trim()}
            style={{
              padding: '14px 24px', borderRadius: 12,
              background: formAccent, color: 'var(--black)',
              fontWeight: 700, fontSize: 14, border: 'none',
              cursor: searching || !searchQuery.trim() ? 'not-allowed' : 'pointer',
              opacity: searching || !searchQuery.trim() ? 0.5 : 1,
              whiteSpace: 'nowrap', fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            {searching ? '…' : 'Cercar'}
          </button>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div style={{
            maxHeight: 320, overflowY: 'auto', marginBottom: 20,
            border: '1px solid var(--border)', borderRadius: 14,
          }}>
            {searchResults.map((result, i) => {
              const addr = result.address || {}
              const name = addr.amenity || result.display_name.split(',')[0]
              const location = [
                [addr.road, addr.house_number].filter(Boolean).join(' '),
                addr.city || addr.town || addr.village,
                addr.postcode,
              ].filter(Boolean).join(', ')

              return (
                <button
                  key={result.place_id || i}
                  onClick={() => handleSelectBar(result)}
                  style={{
                    width: '100%', padding: '14px 16px',
                    background: 'transparent', border: 'none',
                    borderBottom: i < searchResults.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = formAccentSoft }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent' }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                    {location || result.display_name}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Skip button */}
        <button
          onClick={() => { setStep(4); setStatus(null) }}
          style={{
            ...buttonSecondary,
            marginTop: 4,
            textAlign: 'center',
            fontSize: 13,
          }}
        >
          Ometre i introduir les dades manualment →
        </button>

        {statusMessage}
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
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Nom del local *
            <input required value={state.businessName} onChange={set('businessName')} style={inputStyle} placeholder="Bar Can Punyetes" />
          </label>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Adreça *
            <input required value={state.address} onChange={set('address')} style={inputStyle} placeholder="Carrer de Sants 123" />
          </label>
          <label style={labelStyle}>
            Ciutat *
            <input required value={state.city} onChange={set('city')} style={inputStyle} placeholder="Barcelona" />
          </label>
          <label style={labelStyle}>
            Codi postal *
            <input required value={state.postalCode} onChange={set('postalCode')} style={inputStyle} placeholder="08014" maxLength={5} />
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

        <p style={{ ...sectionTitleStyle, marginTop: 28 }}>Dades legals</p>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
          <label style={labelStyle}>
            NIF / CIF *
            <input required value={state.nif} onChange={set('nif')} style={inputStyle} placeholder="B12345678" />
          </label>
          <label style={labelStyle}>
            Raó social
            <input value={state.legalName} onChange={set('legalName')} style={inputStyle} placeholder="Bar Can Punyetes S.L." />
          </label>
        </div>

        <p style={{ ...sectionTitleStyle, marginTop: 28 }}>Persona de contacte</p>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
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
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
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

        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <button
            onClick={() => { setStep(3); setStatus(null) }}
            style={{ ...buttonSecondary, flex: 1, marginTop: 0 }}
          >
            ← Enrere
          </button>
          <button
            onClick={() => {
              if (!state.businessName || !state.address || !state.city || !state.postalCode || !state.nif) {
                setStatus('Omple tots els camps obligatoris (*)')
                return
              }
              setStatus(null)
              setStep(5)
            }}
            style={{ ...buttonPrimary, flex: 2 }}
          >
            Continuar →
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
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
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

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setStep(4)}
            style={{ ...buttonSecondary, flex: 1, marginTop: 0 }}
          >
            ← Enrere
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
        <div style={stepBadge}>
          <Logo size={56} variant="white" visualScale={1.08} maskCircle={false} />
        </div>
        <h2 style={{ margin: 0, fontSize: 26, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
          Benvingut a troBar!
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 16, marginTop: 12, lineHeight: 1.6 }}>
          El teu bar <strong style={{ color: 'var(--text)' }}>{state.businessName}</strong> ha estat registrat correctament.
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>
          Et contactarem aviat per activar el teu perfil.
        </p>

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
