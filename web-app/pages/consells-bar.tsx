import Head from 'next/head'
import { FormEvent, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, User } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { auth, functions } from '../lib/firebase'

export default function ConsellsBar() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => onAuthStateChanged(auth, account => { setUser(account); setReady(true) }), [])
  useEffect(() => {
    setLoaded(false)
    if (!user?.emailVerified) return
    let active = true
    const get = httpsCallable<void, { enabled: boolean }>(functions, 'getBarEmailTips')
    get().then(result => {
      if (typeof result.data.enabled !== 'boolean') throw new Error('Invalid email preference')
      if (active) { setEnabled(result.data.enabled); setLoaded(true); setError('') }
    }).catch(failure => {
      console.error('[EmailTips] Preference unavailable', failure instanceof Error ? failure.name : 'unknown')
      if (active) setError("No s'ha pogut consultar la preferència. Torna-ho a provar.")
    })
    return () => { active = false }
  }, [user, attempt])
  const login = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try { await signInWithEmailAndPassword(auth, email.trim(), password); setPassword('') }
    catch (failure) {
      console.error('[EmailTips] Sign in failed', failure instanceof Error ? failure.name : 'unknown')
      setError("No s'ha pogut iniciar sessió. Comprova les dades del compte.")
    } finally { setBusy(false) }
  }
  const save = async (value: boolean) => {
    if (busy || !loaded) return
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const update = httpsCallable<{ enabled: boolean }, { enabled: boolean }>(functions, 'setBarEmailTips')
      const result = await update({ enabled: value })
      if (result.data.enabled !== value) throw new Error('Email preference not confirmed')
      setEnabled(value)
      setStatus(value ? 'Preferència desada. Només rebràs el consell si el perfil encara és incomplet.' : 'Ja no rebràs consells de perfil. Els avisos de compte i facturació no canvien.')
    } catch (failure) {
      console.error('[EmailTips] Preference save failed', failure instanceof Error ? failure.name : 'unknown')
      setError("No s'ha pogut desar la preferència. Torna-ho a provar.")
    } finally { setBusy(false) }
  }
  return <>
    <Head><title>troBar — Consells del perfil</title><meta name="robots" content="noindex" /></Head>
    <Header />
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '112px 24px 48px' }}>
      <h1>Els correus del teu bar</h1>
      <p>Si ho acceptes, t'enviarem un únic consell al cap de 24 hores si al perfil del teu bar li falten la descripció, les fotos o els serveis. Pots desactivar-lo aquí en qualsevol moment.</p>
      {!ready ? <p role="status">Comprovant el compte…</p> : !user ? <form onSubmit={login} style={{ display: 'grid', gap: 16 }}>
        <p>Inicia sessió amb el compte del bar per consultar o desactivar aquesta preferència.</p>
        <label className="field-label">Correu<input className="field-input" type="email" autoComplete="email" required disabled={busy} value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label className="field-label">Contrasenya<input className="field-input" type="password" autoComplete="current-password" required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></label>
        <button className="btn-slab" disabled={busy} type="submit">{busy ? 'Entrant…' : 'Iniciar sessió'}</button>
      </form> : !user.emailVerified ? <p role="alert">Verifica el correu del compte abans de gestionar aquesta preferència.</p> : <section>
        <p>Compte: {user.email}</p>
        {!loaded ? <><p role="status">Consultant la preferència…</p>{error && <button type="button" onClick={() => setAttempt(value => value + 1)}>Tornar-ho a provar</button>}</> : <>
          <label style={{ display: 'flex', gap: 12, alignItems: 'start', padding: '16px 0' }}>
            <input type="checkbox" checked={enabled} disabled={busy} onChange={event => { void save(event.target.checked) }} />
            Vull rebre un únic consell per completar el perfil del meu bar.
          </label>
          <button type="button" className="btn-slab" disabled={busy || !enabled} onClick={() => { void save(false) }}>Deixar de rebre consells</button>
        </>}
        <p><a href="trobar://bar-dashboard">Obrir el perfil del bar a l’app</a></p>
      </section>}
      {!!status && <p role="status">{status}</p>}
      {!!error && <p role="alert">{error}</p>}
      <p>Aquesta preferència no afecta els correus de facturació, suport o seguretat.</p>
    </main>
    <Footer />
  </>
}
