import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { authActionMessage, prepareAuthAction, PreparedAction } from '../../lib/authAction'
import styles from '../../styles/AuthAction.module.css'

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Referrer-Policy', 'no-referrer')
  return { props: {} }
}

export default function AuthActionPage() {
  const started = useRef<Promise<PreparedAction> | null>(null)
  const locked = useRef(false)
  const [action, setAction] = useState<PreparedAction | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    let active = true
    if (!started.current) {
      const params = new URLSearchParams(window.location.search)
      window.history.replaceState(null, '', window.location.pathname)
      started.current = (async () => {
        const [{ auth }, firebase] = await Promise.all([import('../../lib/firebase'), import('firebase/auth')])
        return prepareAuthAction(params, {
          verifyPasswordResetCode: code => firebase.verifyPasswordResetCode(auth, code),
          confirmPasswordReset: (code, value) => firebase.confirmPasswordReset(auth, code, value),
          applyActionCode: code => firebase.applyActionCode(auth, code),
          validatePassword: async value => (await firebase.validatePassword(auth, value)).isValid,
        })
      })()
    }
    started.current.then(result => {
      if (active) { setAction(result); setComplete(result.kind === 'verified') }
    }).catch(failure => {
      if (active) setError(authActionMessage(failure))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (locked.current || action?.kind !== 'reset' || complete) return
    if (password !== confirmation) { setError('Les contrasenyes no coincideixen.'); return }
    locked.current = true
    setSubmitting(true)
    setError('')
    try {
      await action.complete(password)
      setComplete(true)
      setPassword('')
      setConfirmation('')
    } catch (failure) {
      setError(authActionMessage(failure))
    } finally {
      locked.current = false
      setSubmitting(false)
    }
  }

  return <>
    <Head>
      <title>{complete ? 'Tot a punt' : 'El teu compte'} · troBar</title>
      <meta name="robots" content="noindex, nofollow" />
      <meta name="referrer" content="no-referrer" />
    </Head>
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="action-title">
        <header className={styles.header}>
          <img src="/assets/logos/email-header-pattern.png" alt="troBar" width={560} height={176} />
        </header>
        <div className={styles.body}>
          <h1 id="action-title">{loading ? 'Un moment…' : complete
            ? action?.kind === 'verified' ? 'Correu verificat' : 'Contrasenya actualitzada'
            : action?.kind === 'reset' ? 'Una nova contrasenya' : 'Revisa l’enllaç'}</h1>
          {loading && <p role="status">Estem comprovant l’enllaç de manera segura.</p>}
          {complete && <p role="status">{action?.kind === 'verified'
            ? 'El teu correu ja està verificat. Pots tornar a troBar.'
            : 'Ja pots iniciar sessió a troBar amb la nova contrasenya.'}</p>}
          {error && <div className={styles.notice} role="alert">{error}</div>}
          {!loading && !complete && action?.kind === 'reset' && <form onSubmit={submit}>
            <p>Tria una contrasenya per al teu compte <strong>{action.email}</strong>.</p>
            <label htmlFor="password">Nova contrasenya</label>
            <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
              minLength={8} required value={password} disabled={submitting}
              onChange={event => setPassword(event.target.value)} aria-describedby="password-help" />
            <small id="password-help">Com a mínim 8 caràcters. Evita reutilitzar contrasenyes.</small>
            <label htmlFor="confirmation">Repeteix la contrasenya</label>
            <input id="confirmation" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
              minLength={8} required value={confirmation} disabled={submitting}
              onChange={event => setConfirmation(event.target.value)} />
            <label className={styles.toggle}><input type="checkbox" checked={showPassword}
              onChange={event => setShowPassword(event.target.checked)} /> Mostra les contrasenyes</label>
            <button type="submit" disabled={submitting}>{submitting ? 'Desant…' : 'Desar la contrasenya'}</button>
          </form>}
          {!loading && <a className={styles.back} href="trobar://login">Tornar a l’app</a>}
        </div>
        <footer className={styles.footer}>El teu equip. El teu bar. <a href="/">troBar</a></footer>
      </section>
    </main>
  </>
}
