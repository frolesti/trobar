import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { useRef, useState, FormEvent } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import contactEmails from '../../app/src/data/contactEmails.json'
import styles from '../styles/Contact.module.css'

type Topic = keyof typeof contactEmails

export default function Contacte() {
  const [form, setForm] = useState({ name: '', email: '', message: '', kind: 'general' as Topic, consent: false, website: '' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submission = useRef<{ payload: string; id: string } | null>(null)
  const submitting = useRef(false)
  const feedback = useRef<HTMLDivElement>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setSending(true)
    setError(null)
    try {
      const payload = JSON.stringify(form)
      if (submission.current?.payload !== payload) submission.current = { payload, id: crypto.randomUUID() }
      const requestId = submission.current.id
      const result = await httpsCallable<typeof form & { requestId: string }, { id: string }>(functions, 'submitWebContact')({ ...form, requestId })
      if (result.data.id !== requestId) throw new Error('Invalid contact confirmation')
      setSent(true)
    } catch (cause) {
      const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : ''
      console.error('[Contact] Submission failed', typeof code === 'string' ? code : 'invalid-response')
      setError(code === 'functions/resource-exhausted'
        ? 'Has enviat diverses consultes. Espera una estona abans de tornar-ho a provar.'
        : code === 'functions/failed-precondition'
          ? 'No podem confirmar l’enviament anterior. Escriu-nos directament per correu.'
          : 'No hem pogut confirmar l’enviament. Torna-ho a provar o escriu-nos directament per correu.')
    } finally {
      submitting.current = false
      setSending(false)
      requestAnimationFrame(() => feedback.current?.focus())
    }
  }

  return (
    <>
      <Head>
        <title>troBar — Contacte</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />
      <main className={styles.main}>
        <section className={styles.intro} aria-labelledby="contact-title">
          <span className="eyebrow">Contacte</span>
          <h1 id="contact-title">Parla amb <em>nosaltres</em></h1>
          <p>Tens algun dubte, suggeriment o vols col·laborar? Escriu-nos i et respondrem el més aviat possible.</p>
          <div className={styles.direct}>
            <span>Prefereixes el correu?</span>
            <a href={`mailto:${contactEmails[form.kind]}`}>{contactEmails[form.kind]}</a>
          </div>
        </section>
        <section className={styles.panel} aria-label="Envia una consulta">
          {sent ? (
            <div ref={feedback} tabIndex={-1} role="status" className={styles.success}>
              <span className="eyebrow">Rebut</span>
              <h2>Missatge enviat</h2>
              <p>Gràcies per contactar-nos. Et respondrem al correu que ens has indicat.</p>
              <button type="button" className="btn-ghost" onClick={() => { setSent(false); setForm({ ...form, message: '', consent: false }); submission.current = null }}>Enviar un altre missatge</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form} aria-busy={sending}>
              <fieldset disabled={sending} className={styles.fields}>
                <div>
                  <label htmlFor="contact-kind" className="field-label">Sobre què ens escrius?</label>
                  <select id="contact-kind" name="kind" className="field-input" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as Topic })}>
                    <option value="general">Consultes i col·laboracions</option>
                    <option value="support">Suport, incidències i privacitat</option>
                    <option value="billing">Factures i subscripcions</option>
                  </select>
                </div>
                <div className={styles.row}>
                  <div>
                    <label htmlFor="contact-name" className="field-label">Nom</label>
                    <input id="contact-name" name="name" autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="field-input" />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="field-label">Correu electrònic</label>
                    <input id="contact-email" name="email" type="email" autoComplete="email" spellCheck={false} required maxLength={254} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="field-input" />
                  </div>
                </div>
                <div>
                  <label htmlFor="contact-message" className="field-label">Missatge</label>
                  <textarea id="contact-message" name="message" required minLength={20} maxLength={5000} rows={6} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Explica’ns com et podem ajudar…" className="field-input" />
                </div>
                <div className={styles.trap} aria-hidden="true">
                  <label htmlFor="contact-website">Website</label>
                  <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
                </div>
                <label className={styles.consent}>
                  <input name="consent" type="checkbox" required checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} />
                  <span>He llegit i accepto la <Link href="/politica-privacitat">política de privacitat</Link>.</span>
                </label>
              </fieldset>
              {error && <div ref={feedback} tabIndex={-1} role="alert" className={styles.error}>{error}</div>}
              <button type="submit" disabled={sending} className="btn-slab">{sending ? 'Enviant…' : 'Enviar missatge'}</button>
            </form>
          )}
        </section>
      </main>
      <Footer />
    </>
  )
}
