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

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '140px 24px 80px' }}>
        <h1 style={{ fontSize: 'clamp(36px, 5vw, 54px)', fontWeight: 800, color: '#fff', marginBottom: 16, textAlign: 'center' }}>
          Contacte
        </h1>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 48, maxWidth: 540, margin: '0 auto 48px' }}>
          Tens algun dubte, suggeriment o necessites ajuda? Escriu-nos i et respondrem el més aviat possible.
        </p>

        {sent ? (
          <div style={{
            background: 'var(--card)',
            borderRadius: 16,
            padding: '48px 32px',
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <h2 style={{ fontSize: 24, color: 'var(--text)', marginBottom: 12 }}>Missatge enviat!</h2>
            <p style={{ color: 'var(--muted)', fontSize: 16 }}>
              Gràcies per posar-te en contacte amb nosaltres. Et respondrem el més aviat possible.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{
            background: 'var(--card)',
            borderRadius: 16,
            padding: '40px 32px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Nom</label>
              <input
                type="text"
                required
                value={form.nom}
                onChange={e => setForm({ ...form, nom: e.target.value })}
                placeholder="El teu nom"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  fontSize: 16,
                  fontFamily: 'inherit',
                  outline: 'none',
                  background: '#fafafa'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Correu electrònic</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="nom@exemple.com"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  fontSize: 16,
                  fontFamily: 'inherit',
                  outline: 'none',
                  background: '#fafafa'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Missatge</label>
              <textarea
                required
                rows={5}
                value={form.missatge}
                onChange={e => setForm({ ...form, missatge: e.target.value })}
                placeholder="Escriu el teu missatge..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  fontSize: 16,
                  fontFamily: 'inherit',
                  outline: 'none',
                  resize: 'vertical',
                  background: '#fafafa'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                padding: '16px',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                cursor: sending ? 'wait' : 'pointer',
                opacity: sending ? 0.7 : 1,
                transition: 'transform 0.2s, opacity 0.2s',
                fontFamily: 'inherit'
              }}
            >
              {sending ? 'Enviant...' : 'Enviar missatge'}
            </button>
          </form>
        )}

        <div style={{
          marginTop: 48,
          textAlign: 'center',
          color: 'rgba(255,255,255,0.6)',
          fontSize: 15,
          lineHeight: 1.8
        }}>
          <p>També ens pots escriure directament a:</p>
          <a href="mailto:contacte@trobar.app" style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 17 }}>
            contacte@trobar.app
          </a>
        </div>
      </main>

      <Footer />
    </>
  )
}
