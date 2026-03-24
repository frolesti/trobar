import { useState } from 'react'

type Cycle = 'monthly' | 'quarterly' | 'annual'

const CYCLES: Record<Cycle, { label: string; price: number; months: number; savePct?: string; saveYear?: number }> = {
  monthly:   { label: 'Mensual',    price: 39, months: 1 },
  quarterly: { label: 'Trimestral', price: 33, months: 3, savePct: '15%', saveYear: 72 },
  annual:    { label: 'Anual',      price: 29, months: 12, savePct: '25%', saveYear: 120 },
}

const features = [
  { text: 'Perfil verificat amb insígnia', icon: '✓' },
  { text: 'Apareix destacat al mapa', icon: '✓' },
  { text: 'Anuncia partits que emets', icon: '✓' },
  { text: 'Fins a 10 fotos del local', icon: '✓' },
  { text: 'Horaris d\'obertura en temps real', icon: '✓' },
  { text: 'Equipament i amenitats visibles', icon: '✓' },
  { text: 'Notificacions als culers propers', icon: '✓' },
  { text: 'Suport prioritari per email', icon: '✓' },
]

export default function Pricing() {
  const [cycle, setCycle] = useState<Cycle>('quarterly')

  const sel = CYCLES[cycle]
  const totalLabel = cycle === 'monthly'
    ? `${sel.price}€/mes`
    : cycle === 'quarterly'
      ? `${sel.price * 3}€ cada 3 mesos`
      : `${sel.price * 12}€/any`

  // Savings vs monthly
  const monthlyCost = CYCLES.monthly.price
  const yearlySaving = (monthlyCost - sel.price) * 12

  return (
    <section id="preus" style={{ padding: '0' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h2 style={{ fontSize: 36, marginBottom: 16, color: '#fff' }}>Un sol pla, sense sorpreses</h2>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 18, maxWidth: 520, margin: '0 auto' }}>
          Tot inclòs per fer créixer el teu negoci cada dia de partit. Prova 14 dies gratis.
        </p>
      </div>

      {/* Billing cycle toggle */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 6,
        background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 4,
        maxWidth: 420, margin: '0 auto 40px',
      }}>
        {(Object.keys(CYCLES) as Cycle[]).map(key => {
          const c = CYCLES[key]
          const active = cycle === key
          return (
            <button
              key={key}
              onClick={() => setCycle(key)}
              style={{
                flex: 1, padding: '12px 8px', borderRadius: 10,
                border: 'none', cursor: 'pointer',
                background: active ? '#fff' : 'transparent',
                color: active ? 'var(--text)' : 'rgba(255,255,255,0.6)',
                fontWeight: active ? 700 : 500,
                fontSize: 14, fontFamily: 'inherit',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              {c.label}
              {c.saveYear && (
                <span style={{
                  display: 'block', fontSize: 10, fontWeight: 600,
                  color: active ? 'var(--accent)' : 'var(--gold)',
                  marginTop: 2,
                }}>
                  Estalvia {c.saveYear}€/any
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Main pricing card */}
      <div style={{
        maxWidth: 520, margin: '0 auto',
        background: 'var(--blue)', borderRadius: 28,
        padding: '48px 40px', color: '#fff',
        boxShadow: '0 24px 60px rgba(0, 77, 152, 0.3)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Savings badge — only for non-monthly */}
        {sel.savePct && (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            background: 'var(--gold)', color: 'var(--text)',
            padding: '8px 16px', fontSize: 12, fontWeight: 800,
            borderRadius: '0 0 0 16px',
            letterSpacing: 0.3,
          }}>
            -{sel.savePct}
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, opacity: 0.8 }}>
            troBar per a Bars
          </h3>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
            {sel.price < monthlyCost && (
              <span style={{ fontSize: 28, opacity: 0.4, textDecoration: 'line-through', marginRight: 8 }}>{monthlyCost}€</span>
            )}
            <span style={{ fontSize: 64, fontWeight: 800, lineHeight: 1 }}>{sel.price}€</span>
            <span style={{ fontSize: 20, opacity: 0.6 }}>/mes</span>
          </div>
          <p style={{ fontSize: 13, opacity: 0.5, marginTop: 8 }}>
            Facturat com {totalLabel}
          </p>
          {yearlySaving > 0 && (
            <p style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginTop: 6 }}>
              T&apos;estalvies {yearlySaving}€/any
            </p>
          )}
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px' }}>
          {features.map((feat, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              marginBottom: 14, fontSize: 15,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(237,187,0,0.15)', color: 'var(--gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>✓</span>
              {feat.text}
            </li>
          ))}
        </ul>

        <a href="/registra-bar" style={{
          display: 'block', textAlign: 'center',
          background: 'var(--gold)', color: 'var(--blue)',
          padding: 18, borderRadius: 14,
          fontWeight: 800, fontSize: 17,
          textDecoration: 'none',
          transition: 'transform 0.2s',
          boxShadow: '0 8px 24px rgba(237,187,0,0.25)',
        }}>
          Provar 14 dies gratis
        </a>

        <p style={{ textAlign: 'center', fontSize: 12, opacity: 0.5, marginTop: 14 }}>
          Cancel·la quan vulguis. Sense compromís.
        </p>
      </div>

      {/* ROI comparison */}
      <div style={{
        maxWidth: 520, margin: '40px auto 0',
        background: 'rgba(255,255,255,0.06)', borderRadius: 20,
        padding: '32px 28px', border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <h4 style={{ fontSize: 18, color: '#fff', textAlign: 'center', marginBottom: 24, fontFamily: 'Lora, serif' }}>
          Compensa des del primer dia de partit
        </h4>

        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {/* Cost */}
          <div style={{
            flex: 1, textAlign: 'center', padding: 16, borderRadius: 14,
            background: 'rgba(165,0,68,0.15)', border: '1px solid rgba(165,0,68,0.2)',
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 600 }}>La teva inversió</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>~1€<span style={{ fontSize: 14, fontWeight: 400, opacity: 0.6 }}>/dia</span></div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>amb el pla trimestral</div>
          </div>
          {/* Gain */}
          <div style={{
            flex: 1, textAlign: 'center', padding: 16, borderRadius: 14,
            background: 'rgba(237,187,0,0.12)', border: '1px solid rgba(237,187,0,0.2)',
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 600 }}>Potencial per partit</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>+200€</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>amb 20 culers extres</div>
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
          Un bar factura de mitjana <strong style={{ color: '#fff' }}>10€ per client</strong> en un dia de partit.
          Amb només <strong style={{ color: '#fff' }}>2 clients nous al mes</strong> ja has cobert la subscripció.
          Imagina&apos;t amb 4 partits per setmana.
        </p>
      </div>
    </section>
  )
}