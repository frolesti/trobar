import { useState } from 'react'

type Cycle = 'monthly' | 'quarterly' | 'annual'

const CYCLES: Record<Cycle, { label: string; price: number; months: number; savePct?: string; saveYear?: number }> = {
  monthly:   { label: 'Mensual',    price: 39, months: 1 },
  quarterly: { label: 'Trimestral', price: 33, months: 3, savePct: '15%', saveYear: 72 },
  annual:    { label: 'Anual',      price: 29, months: 12, savePct: '25%', saveYear: 120 },
}

const features = [
  'Perfil verificat amb insígnia',
  'Apareix destacat al mapa',
  'Anuncia partits que emets',
  'Fins a 10 fotos del local',
  'Horaris d\'obertura en temps real',
  'Equipament i amenitats visibles',
  'Notificacions als culers propers',
  'Suport prioritari per email',
]

export default function Pricing() {
  const [cycle, setCycle] = useState<Cycle>('quarterly')

  const sel = CYCLES[cycle]
  const totalLabel = cycle === 'monthly'
    ? `${sel.price}€/mes`
    : cycle === 'quarterly'
      ? `${sel.price * 3}€ cada 3 mesos`
      : `${sel.price * 12}€/any`

  const monthlyCost = CYCLES.monthly.price
  const yearlySaving = (monthlyCost - sel.price) * 12

  return (
    <section id="preus" style={{ padding: 0 }}>
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <span style={{display:'inline-block', fontSize:12, fontWeight:600, color:'#edbb00', letterSpacing:2, textTransform:'uppercase', marginBottom:16}}>Preus</span>
        <h2 style={{ fontSize: 'clamp(32px, 4vw, 44px)', marginBottom: 14, color: '#fff' }}>Un sol pla, sense sorpreses</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17, maxWidth: 500, margin: '0 auto' }}>
          Tot inclòs per fer créixer el teu negoci cada dia de partit. Prova 14 dies gratis.
        </p>
      </div>

      {/* Billing cycle toggle */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 4,
        background: 'rgba(0,0,0,0.3)', borderRadius: 14, padding: 4,
        maxWidth: 400, margin: '0 auto 48px',
        border: '1px solid rgba(255,255,255,0.1)',
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
                background: active
                  ? 'rgba(255,255,255,0.15)'
                  : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                fontWeight: active ? 700 : 500,
                fontSize: 14, fontFamily: 'inherit',
                transition: 'all 0.3s',
                position: 'relative',
                boxShadow: active ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
              }}
            >
              {c.label}
              {c.saveYear && (
                <span style={{
                  display: 'block', fontSize: 10, fontWeight: 600,
                  color: active ? 'var(--gold)' : 'rgba(237,187,0,0.5)',
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
        background: 'linear-gradient(135deg, #004d98, #003570)',
        borderRadius: 28,
        padding: '52px 40px', color: '#fff',
        boxShadow: '0 12px 40px rgba(0,77,152,0.25)',
        position: 'relative', overflow: 'hidden',
        border: '1px solid rgba(0,77,152,0.3)',
      }}>
        {/* Decorative glow */}
        <div style={{position:'absolute', top:-80, right:-80, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle, rgba(237,187,0,0.08), transparent 70%)', pointerEvents:'none'}} />

        {sel.savePct && (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            background: 'linear-gradient(135deg, var(--gold), #ffd54f)',
            color: '#1a1a2e',
            padding: '8px 16px', fontSize: 12, fontWeight: 800,
            borderRadius: '0 0 0 16px',
            letterSpacing: 0.3,
          }}>
            -{sel.savePct}
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, opacity: 0.5 }}>
            troBar per a Bars
          </h3>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
            {sel.price < monthlyCost && (
              <span style={{ fontSize: 28, opacity: 0.3, textDecoration: 'line-through', marginRight: 8 }}>{monthlyCost}€</span>
            )}
            <span style={{ fontSize: 64, fontWeight: 800, lineHeight: 1 }}>{sel.price}€</span>
            <span style={{ fontSize: 20, opacity: 0.4 }}>/mes</span>
          </div>
          <p style={{ fontSize: 13, opacity: 0.35, marginTop: 8 }}>
            Facturat com {totalLabel}
          </p>
          {yearlySaving > 0 && (
            <p style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginTop: 6 }}>
              T&apos;estalvies {yearlySaving}€/any
            </p>
          )}
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 36px' }}>
          {features.map((feat, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              marginBottom: 14, fontSize: 15,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(237,187,0,0.18)', color: '#edbb00',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
                border: '1px solid rgba(237,187,0,0.1)',
              }}>✓</span>
              <span style={{opacity: 0.85}}>{feat}</span>
            </li>
          ))}
        </ul>

        <a href="/registra-bar" style={{
          display: 'block', textAlign: 'center',
          background: 'linear-gradient(135deg, var(--gold), #ffd54f)',
          color: '#1a1a2e',
          padding: 18, borderRadius: 14,
          fontWeight: 800, fontSize: 17,
          textDecoration: 'none',
          transition: 'transform 0.2s',
          boxShadow: '0 0 40px rgba(237,187,0,0.15), 0 8px 24px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          Provar 14 dies gratis
        </a>

        <p style={{ textAlign: 'center', fontSize: 12, opacity: 0.35, marginTop: 14 }}>
          Cancel·la quan vulguis. Sense compromís.
        </p>
      </div>

      {/* ROI comparison */}
      <div style={{
        maxWidth: 520, margin: '40px auto 0',
        padding: '36px 28px',
        background: '#004d98', borderRadius: 20,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <h4 style={{ fontSize: 18, color: '#fff', textAlign: 'center', marginBottom: 24, fontFamily: 'Lora, serif' }}>
          Compensa des del primer dia de partit
        </h4>

        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div style={{
            flex: 1, textAlign: 'center', padding: 16, borderRadius: 14,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)',
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6, fontWeight: 600 }}>La teva inversió</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>~1€<span style={{ fontSize: 14, fontWeight: 400, opacity: 0.5 }}>/dia</span></div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>amb el pla trimestral</div>
          </div>
          <div style={{
            flex: 1, textAlign: 'center', padding: 16, borderRadius: 14,
            background: 'rgba(237,187,0,0.15)', border: '1px solid rgba(237,187,0,0.22)',
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6, fontWeight: 600 }}>Potencial per partit</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#edbb00' }}>+200€</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>amb 20 culers extres</div>
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
          Un bar factura de mitjana <strong style={{ color: '#fff' }}>10€ per client</strong> en un dia de partit.
          Amb només <strong style={{ color: '#fff' }}>2 clients nous al mes</strong> ja has cobert la subscripció.
        </p>
      </div>
    </section>
  )
}