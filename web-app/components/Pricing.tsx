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

/**
 * Pricing editorial. Sense gradients durs ni caixes blaves: el degradat
 * del body es veu a través d'una superfície gairebé transparent amb hairlines.
 */
export default function Pricing() {
  const [cycle, setCycle] = useState<Cycle>('quarterly')

  const sel = CYCLES[cycle]
  const totalLabel = cycle === 'monthly'
    ? `${sel.price}€ cada mes`
    : cycle === 'quarterly'
      ? `${sel.price * 3}€ cada 3 mesos`
      : `${sel.price * 12}€ cada any`

  const monthlyCost = CYCLES.monthly.price
  const yearlySaving = (monthlyCost - sel.price) * 12

  return (
    <section id="preus">
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <span className="eyebrow">Preus</span>
        <h2 style={{ marginBottom: 14 }}>
          Un sol pla, <em style={{ color: 'var(--gold)', fontWeight: 500 }}>sense sorpreses</em>
        </h2>
        <p style={{ maxWidth: 500, margin: '0 auto', fontSize: 17 }}>
          Tot inclòs per fer créixer el teu negoci cada dia de partit. Prova 14 dies gratis.
        </p>
      </div>

      {/* Cycle selector — pestanyes editorials */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 0,
        maxWidth: 540, margin: '0 auto 48px',
        borderTop: '1px solid var(--hairline)',
        borderBottom: '1px solid var(--hairline)',
      }}>
        {(Object.keys(CYCLES) as Cycle[]).map(key => {
          const c = CYCLES[key]
          const active = cycle === key
          return (
            <button
              key={key}
              onClick={() => setCycle(key)}
              style={{
                flex: 1, padding: '20px 8px',
                border: 'none',
                background: 'transparent',
                color: active ? 'var(--paper)' : 'var(--paper-faint)',
                fontFamily: 'Lora, serif',
                fontStyle: active ? 'normal' : 'italic',
                fontWeight: active ? 700 : 400,
                fontSize: 15,
                cursor: 'pointer',
                borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
                marginBottom: -1,
                transition: 'all 0.25s',
              }}
            >
              {c.label}
              {c.saveYear && (
                <span style={{
                  display: 'block', fontSize: 11, marginTop: 4,
                  color: active ? 'var(--gold)' : 'var(--paper-faint)',
                  fontStyle: 'italic', fontWeight: 500,
                  letterSpacing: 0.5,
                }}>
                  estalvia {c.saveYear}€/any
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Card editorial */}
      <div style={{
        maxWidth: 560, margin: '0 auto',
        padding: '56px 44px',
        border: '1px solid var(--hairline)',
        background: 'rgba(13,27,42,0.25)',
        backdropFilter: 'blur(8px)',
        position: 'relative',
      }}>
        {sel.savePct && (
          <span style={{
            position: 'absolute', top: 20, right: 20,
            fontFamily: 'Lora, serif', fontStyle: 'italic',
            fontSize: 13, color: 'var(--gold)',
            letterSpacing: 1,
          }}>
            −{sel.savePct}
          </span>
        )}

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span className="eyebrow" style={{ marginBottom: 12 }}>troBar per a bars</span>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
            {sel.price < monthlyCost && (
              <span style={{
                fontFamily: 'Lora, serif', fontSize: 22,
                color: 'var(--paper-faint)',
                textDecoration: 'line-through',
                marginRight: 6,
              }}>{monthlyCost}€</span>
            )}
            <span style={{
              fontFamily: 'Lora, serif', fontSize: 82,
              fontWeight: 700, lineHeight: 1,
              color: 'var(--paper)', letterSpacing: -2,
            }}>{sel.price}€</span>
            <span style={{
              fontFamily: 'Lora, serif', fontStyle: 'italic',
              fontSize: 18, color: 'var(--paper-mute)',
            }}>/mes</span>
          </div>
          <p style={{
            fontSize: 13, marginTop: 12,
            color: 'var(--paper-faint)', fontStyle: 'italic',
          }}>
            facturat com {totalLabel}
          </p>
          {yearlySaving > 0 && (
            <p style={{
              fontSize: 14, marginTop: 6,
              color: 'var(--gold)', fontStyle: 'italic',
            }}>
              t&apos;estalvies {yearlySaving}€ l&apos;any
            </p>
          )}
        </div>

        <ul className="legal" style={{ marginBottom: 40 }}>
          {features.map((feat, i) => (
            <li key={i} style={{ fontSize: 15, color: 'var(--paper)' }}>{feat}</li>
          ))}
        </ul>

        <a href="/registra-bar" className="btn-slab" style={{
          display: 'block', textAlign: 'center', width: '100%',
        }}>
          Prova 14 dies gratis
        </a>

        <p style={{
          textAlign: 'center', fontSize: 13, marginTop: 14,
          color: 'var(--paper-faint)', fontStyle: 'italic',
        }}>
          Cancel·la quan vulguis. Sense compromís.
        </p>
      </div>

      {/* ROI */}
      <div style={{
        maxWidth: 560, margin: '40px auto 0',
        padding: '36px 32px',
        borderTop: '1px solid var(--hairline)',
      }}>
        <h4 style={{
          textAlign: 'center', marginBottom: 28,
          fontStyle: 'italic', fontWeight: 500, fontSize: 18,
        }}>
          Compensa des del primer dia de partit
        </h4>

        <div style={{ display: 'flex', gap: 32, marginBottom: 24, textAlign: 'center' }}>
          <div style={{ flex: 1 }}>
            <span className="eyebrow" style={{ fontSize: 11, marginBottom: 8 }}>
              La teva inversió
            </span>
            <div style={{ fontFamily: 'Lora, serif', fontWeight: 700, fontSize: 32, color: 'var(--paper)' }}>
              ~1€<span style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--paper-faint)' }}>/dia</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--paper-faint)', marginTop: 4, fontStyle: 'italic' }}>
              amb el pla trimestral
            </p>
          </div>
          <div style={{ flex: 1, borderLeft: '1px solid var(--hairline)' }}>
            <span className="eyebrow" style={{ fontSize: 11, marginBottom: 8 }}>
              Potencial per partit
            </span>
            <div style={{ fontFamily: 'Lora, serif', fontWeight: 700, fontSize: 32, color: 'var(--gold)' }}>
              +200€
            </div>
            <p style={{ fontSize: 12, color: 'var(--paper-faint)', marginTop: 4, fontStyle: 'italic' }}>
              amb 20 culers extres
            </p>
          </div>
        </div>

        <p style={{ fontSize: 14, textAlign: 'center', lineHeight: 1.7, margin: 0, color: 'var(--paper-mute)' }}>
          Un bar factura de mitjana <strong style={{ color: 'var(--paper)' }}>10€ per client</strong> en un dia de partit.
          Amb només <strong style={{ color: 'var(--paper)' }}>2 clients nous al mes</strong> ja has cobert la subscripció.
        </p>
      </div>
    </section>
  )
}
