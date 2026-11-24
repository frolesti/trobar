import Head from 'next/head'
import { FormEvent, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { auth, functions } from '../lib/firebase'
import contactEmails from '../../app/src/data/contactEmails.json'

export default function Subscripcio() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => onAuthStateChanged(auth, account => { setUser(account); setReady(true) }), [])

  const manage = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (!user) await signInWithEmailAndPassword(auth, email.trim(), password)
      const create = httpsCallable<void, { url: string }>(functions, 'createBillingPortalSession')
      const result = await create()
      const url = new URL(result.data.url)
      if (url.origin !== 'https://billing.stripe.com' || url.username || url.password) throw new Error('Invalid billing portal origin')
      window.location.assign(url.href)
    } catch (failure) {
      console.error('[BillingPortal] No s’ha pogut obrir la gestió', failure instanceof Error ? failure.name : 'unknown')
      setError("No s'ha pogut obrir la gestió. Comprova el compte i la contrasenya, verifica el correu i torna-ho a provar. Si continua passant, contacta amb facturació.")
      setBusy(false)
    }
  }

  const changeAccount = async () => {
    setBusy(true)
    setError('')
    try {
      await signOut(auth)
      setPassword('')
    } catch (failure) {
      console.error('[BillingPortal] No s’ha pogut canviar de compte', failure instanceof Error ? failure.name : 'unknown')
      setError("No s'ha pogut tancar la sessió. Torna-ho a provar.")
    } finally { setBusy(false) }
  }

  return <>
    <Head><title>troBar — Gestiona la subscripció</title><meta name="robots" content="noindex" /></Head>
    <Header />
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '112px 24px 48px' }}>
      <h1>La teva <em>subscripció</em></h1>
      <p role="note">Estem en fase beta. Els imports i pagaments de Stripe són de prova.</p>
      <p>Revisa les factures, actualitza el mètode de pagament o cancel·la la renovació a Stripe, la passarel·la segura de pagament.</p>
      {!ready ? <p role="status">Comprovant el compte…</p> : <form onSubmit={manage} style={{ display: 'grid', gap: 16 }}>
        {!user && <>
          <label className="field-label">Correu del compte del bar
            <input className="field-input" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} />
          </label>
          <label className="field-label">Contrasenya
            <input className="field-input" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} />
          </label>
        </>}
        {user && <div>
          <p>Compte: {user.email}</p>
          <button type="button" disabled={busy} onClick={changeAccount} style={{ minHeight: 44 }}>Canviar de compte</button>
        </div>}
        <button className="btn-slab" type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Obrint Stripe…' : 'Gestionar la subscripció'}</button>
        {error && <p role="alert">{error}</p>}
      </form>}
      <p style={{ marginTop: 24 }}>Necessites ajuda? <a href={`mailto:${contactEmails.billing}`}>{contactEmails.billing}</a></p>
    </main>
    <Footer />
  </>
}
