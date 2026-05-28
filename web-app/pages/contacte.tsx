import Head from 'next/head'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { useState, FormEvent } from 'react'

export default function Contacte() {
  const [form, setForm] = useState({ nom: '', email: '', missatge: '' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSending(true)
    await new Promise(r => setTimeout(r, 800))
    setSent(true)
    setSending(false)
  }

  return (
    <>
      <Head>
        <title>troBar — Contacte</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />

      <main style={{ maxWidth: 620, margin: '0 auto', padding: '160px 24px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span className="eyebrow">Contacte</span>
          <h1 style={{ marginBottom: 16 }}>
            Parla amb <em style={{ color: 'var(--gold)', fontWeight: 500 }}>nosaltres</em>
          </h1>
          <p style={{ maxWidth: 480, margin: '0 auto', fontSize: 17 }}>
            Tens algun dubte, suggeriment o vols col·laborar? Escriu-nos i et respondrem el més aviat possible.
          </p>
        </div>

        {sent ? (
          <div style={{
            padding: '64px 32px',
            textAlign: 'center',
            borderTop: '1px solid var(--hairline)',
            borderBottom: '1px solid var(--hairline)',
          }}>
            <span className="eyebrow" style={{ color: 'var(--gold)' }}>Rebut</span>
            <h2 style={{ marginBottom: 12 }}>Missatge enviat</h2>
            <p style={{ margin: 0, fontSize: 16 }}>
              Gràcies per contactar-nos. Et respondrem el més aviat possible.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{
            display: 'flex', flexDirection: 'column', gap: 32,
          }}>
            <div>
              <label className="field-label">Nom</label>
              <input
                type="text"
                required
                value={form.nom}
                onChange={e => setForm({ ...form, nom: e.target.value })}
                placeholder="El teu nom"
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label">Correu electrònic</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="nom@exemple.com"
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label">Missatge</label>
              <textarea
                required
                rows={5}
                value={form.missatge}
                onChange={e => setForm({ ...form, missatge: e.target.value })}
                placeholder="Escriu el teu missatge..."
                className="field-input"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="btn-slab"
              style={{
                cursor: sending ? 'wait' : 'pointer',
                opacity: sending ? 0.7 : 1,
                marginTop: 8,
              }}
            >
              {sending ? 'Enviant...' : 'Enviar missatge'}
            </button>
          </form>
        )}

        <div style={{
          marginTop: 64, textAlign: 'center',
          fontSize: 15, color: 'var(--paper-mute)',
        }}>
          <p>O escriu-nos directament a</p>
          <a href="mailto:hola@trobar-app.cat" style={{ color: 'var(--gold)', fontStyle: 'normal' }}>
            hola@trobar-app.cat
          </a>
        </div>
      </main>

      <Footer />
    </>
  )
}
