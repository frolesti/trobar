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
    // TODO: connect to backend / email API
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

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '140px 24px 80px' }}>
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, color: 'var(--text)', marginBottom: 12, textAlign: 'center', fontFamily: 'Lora, serif' }}>
          Parla amb nosaltres
        </h1>
        <p style={{ fontSize: 17, color: 'var(--muted)', textAlign: 'center', maxWidth: 480, margin: '0 auto 48px', lineHeight: 1.6 }}>
          Tens algun dubte, suggeriment o vols col·laborar? Escriu-nos i et respondrem el més aviat possible.
        </p>

        {sent ? (
          <div style={{
            background: 'var(--card)',
            borderRadius: 20,
            padding: '56px 32px',
            textAlign: 'center',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(46,204,113,0.15)', margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, color: '#2ecc71',
            }}>✓</div>
            <h2 style={{ fontSize: 24, color: 'var(--text)', marginBottom: 12, fontFamily: 'Lora, serif' }}>Missatge enviat!</h2>
            <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.6 }}>
              Gràcies per contactar-nos. Et respondrem el més aviat possible.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{
            background: 'var(--card)',
            borderRadius: 20,
            padding: '36px 32px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nom</label>
              <input
                type="text"
                required
                value={form.nom}
                onChange={e => setForm({ ...form, nom: e.target.value })}
                placeholder="El teu nom"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  fontSize: 16,
                  fontFamily: 'inherit',
                  outline: 'none',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Correu electrònic</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="nom@exemple.com"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  fontSize: 16,
                  fontFamily: 'inherit',
                  outline: 'none',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Missatge</label>
              <textarea
                required
                rows={5}
                value={form.missatge}
                onChange={e => setForm({ ...form, missatge: e.target.value })}
                placeholder="Escriu el teu missatge..."
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  fontSize: 16,
                  fontFamily: 'inherit',
                  outline: 'none',
                  resize: 'vertical',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              style={{
                background: 'var(--gold)',
                color: '#1A1A2E',
                border: 'none',
                padding: '16px',
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 700,
                cursor: sending ? 'wait' : 'pointer',
                opacity: sending ? 0.7 : 1,
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                marginTop: 4,
              }}
            >
              {sending ? 'Enviant...' : 'Enviar missatge'}
            </button>
          </form>
        )}

        <div style={{
          marginTop: 48,
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: 15,
          lineHeight: 1.8,
        }}>
          <p>O escriu-nos directament a</p>
          <a href="mailto:hola@trobar.app" style={{ color: 'var(--blue)', fontWeight: 600, fontSize: 17 }}>
            hola@trobar.app
          </a>
        </div>
      </main>

      <Footer />
    </>
  )
}
