import { useState } from 'react'

type PlanType = 'basic' | 'pro' | 'premium'

const PLANS: Record<PlanType, { name: string; price: string; priceId: string }> = {
  basic:   { name: 'Bàsic',   price: 'Gratis',  priceId: '' },
  pro:     { name: 'Pro',     price: '29€/mes', priceId: 'price_pro_monthly' },
  premium: { name: 'Premium', price: '79€/mes', priceId: 'price_premium_monthly' },
}

interface FormState {
  /* Dades del local */
  businessName: string
  address: string
  city: string
  postalCode: string
  phone: string
  website: string
  /* Dades legals */
  nif: string
  legalName: string
  /* Contacte */
  contactName: string
  contactEmail: string
  contactPhone: string
  password: string
  /* Detalls del local */
  capacity: string
  screens: string
  openingHours: string
  description: string
  /* Pla */
  plan: PlanType
  /* Acceptació */
  acceptTerms: boolean
}

const initialState: FormState = {
  businessName: '', address: '', city: '', postalCode: '', phone: '', website: '',
  nif: '', legalName: '',
  contactName: '', contactEmail: '', contactPhone: '', password: '',
  capacity: '', screens: '', openingHours: '', description: '',
  plan: 'pro',
  acceptTerms: false,
}

export default function ContactForm() {
  const [state, setState] = useState<FormState>(initialState)
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (key: keyof FormState) => (e: any) =>
    setState(s => ({ ...s, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!state.acceptTerms) {
      setStatus('Error: Has d\'acceptar les condicions abans de continuar.')
      return
    }
    setLoading(true)
    setStatus('Creant compte de bar...')
    try {
      const res = await fetch('/api/register-bar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      })
      const json = await res.json()
      if (json?.ok) {
        // Si el pla requereix pagament, redirigir a Stripe Checkout
        if (json.checkoutUrl) {
          setStatus('Redirigint al pagament...')
          window.location.href = json.checkoutUrl
          return
        }
        setStatus('Compte creat correctament! Revisa el teu email.')
        setState(initialState)
      } else {
        setStatus('Error: ' + (json?.error || 'Desconegut'))
      }
    } catch (err: any) {
      setStatus('Error: ' + err?.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: 12, marginTop: 6, borderRadius: 10,
    border: '1px solid var(--border)', fontSize: 15, fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  }

  const labelStyle: React.CSSProperties = {
    fontWeight: 600, fontSize: 14, color: 'var(--text)', display: 'block',
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 15, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 16, marginTop: 8,
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--card)', padding: 36, borderRadius: 20,
        boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
      }}
    >
      {/* ─── DADES DEL LOCAL ─── */}
      <p style={sectionTitleStyle}>Dades del local</p>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
        <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
          Nom del local *
          <input required value={state.businessName} onChange={set('businessName')} style={inputStyle} placeholder="Bar Can Punyetes" />
        </label>
        <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
          Adreça *
          <input required value={state.address} onChange={set('address')} style={inputStyle} placeholder="Carrer de Sants 123" />
        </label>
        <label style={labelStyle}>
          Ciutat *
          <input required value={state.city} onChange={set('city')} style={inputStyle} placeholder="Barcelona" />
        </label>
        <label style={labelStyle}>
          Codi postal *
          <input required value={state.postalCode} onChange={set('postalCode')} style={inputStyle} placeholder="08014" maxLength={5} />
        </label>
        <label style={labelStyle}>
          Telèfon del local
          <input value={state.phone} onChange={set('phone')} style={inputStyle} placeholder="93 123 45 67" type="tel" />
        </label>
        <label style={labelStyle}>
          Pàgina web
          <input value={state.website} onChange={set('website')} style={inputStyle} placeholder="https://..." type="url" />
        </label>
      </div>

      {/* ─── DADES LEGALS ─── */}
      <p style={{ ...sectionTitleStyle, marginTop: 32 }}>Dades legals</p>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
        <label style={labelStyle}>
          NIF / CIF *
          <input required value={state.nif} onChange={set('nif')} style={inputStyle} placeholder="B12345678" />
        </label>
        <label style={labelStyle}>
          Raó social
          <input value={state.legalName} onChange={set('legalName')} style={inputStyle} placeholder="Bar Can Punyetes S.L." />
        </label>
      </div>

      {/* ─── PERSONA DE CONTACTE ─── */}
      <p style={{ ...sectionTitleStyle, marginTop: 32 }}>Persona de contacte</p>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
        <label style={labelStyle}>
          Nom complet *
          <input required value={state.contactName} onChange={set('contactName')} style={inputStyle} placeholder="Joan Garcia" />
        </label>
        <label style={labelStyle}>
          Telèfon de contacte
          <input value={state.contactPhone} onChange={set('contactPhone')} style={inputStyle} placeholder="600 123 456" type="tel" />
        </label>
        <label style={labelStyle}>
          Email *
          <input required type="email" value={state.contactEmail} onChange={set('contactEmail')} style={inputStyle} placeholder="joan@barcanpunyetes.cat" />
        </label>
        <label style={labelStyle}>
          Contrasenya *
          <input required type="password" value={state.password} onChange={set('password')} style={inputStyle} placeholder="Mínim 8 caràcters" minLength={8} />
        </label>
      </div>

      {/* ─── DETALLS DEL LOCAL ─── */}
      <p style={{ ...sectionTitleStyle, marginTop: 32 }}>Detalls del local</p>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
        <label style={labelStyle}>
          Aforament (persones)
          <input value={state.capacity} onChange={set('capacity')} style={inputStyle} placeholder="80" type="number" min={1} />
        </label>
        <label style={labelStyle}>
          Nombre de pantalles
          <input value={state.screens} onChange={set('screens')} style={inputStyle} placeholder="4" type="number" min={0} />
        </label>
        <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
          Horari d&apos;obertura
          <input value={state.openingHours} onChange={set('openingHours')} style={inputStyle} placeholder="Dl-Dv: 10-02h / Ds-Dg: 11-03h" />
        </label>
        <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
          Descripció breu del local
          <textarea value={state.description} onChange={set('description')} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Bar de barri amb ambient futboler, tapes casolanes i bon rotllo..." maxLength={500} />
        </label>
      </div>

      {/* ─── SELECCIÓ DE PLA ─── */}
      <p style={{ ...sectionTitleStyle, marginTop: 32 }}>Tria el teu pla</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {(Object.keys(PLANS) as PlanType[]).map(key => {
          const plan = PLANS[key]
          const selected = state.plan === key
          return (
            <label
              key={key}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '16px 12px', borderRadius: 14, cursor: 'pointer',
                border: selected ? '2px solid var(--accent)' : '2px solid var(--border)',
                background: selected ? 'var(--accent)' : 'var(--card)',
                color: selected ? '#fff' : 'var(--text)',
                transition: 'all 0.2s',
              }}
            >
              <input
                type="radio" name="plan" value={key}
                checked={selected} onChange={() => setState(s => ({ ...s, plan: key }))}
                style={{ display: 'none' }}
              />
              <span style={{ fontWeight: 700, fontSize: 16 }}>{plan.name}</span>
              <span style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{plan.price}</span>
            </label>
          )
        })}
      </div>

      {/* ─── ACCEPTACIÓ DE CONDICIONS ─── */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 28, cursor: 'pointer', fontSize: 14, color: 'var(--muted)' }}>
        <input
          type="checkbox" checked={state.acceptTerms}
          onChange={set('acceptTerms')}
          style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--accent)' } as React.CSSProperties}
        />
        <span>
          He llegit i accepto les{' '}
          <a href="/termes-condicions" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Condicions del Servei</a>
          {' '}i la{' '}
          <a href="/politica-privacitat" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Política de Privacitat</a>.
        </span>
      </label>

      {/* ─── BOTÓ D'ENVIAMENT ─── */}
      <button
        type="submit"
        disabled={loading || !state.acceptTerms}
        style={{
          width: '100%', marginTop: 24, padding: 16, borderRadius: 14,
          background: state.acceptTerms ? 'var(--accent)' : 'var(--muted)',
          color: '#fff', fontWeight: 'bold', fontSize: 16, border: 'none',
          cursor: state.acceptTerms ? 'pointer' : 'not-allowed',
          opacity: loading ? 0.6 : 1,
          transition: 'all 0.2s',
          boxShadow: state.acceptTerms ? '0 8px 24px rgba(165,0,68,0.15)' : 'none',
        }}
      >
        {loading ? 'Processant...' : state.plan === 'basic' ? 'Registrar Bar' : `Registrar i pagar · ${PLANS[state.plan].price}`}
      </button>

      {status && (
        <div style={{
          color: status.includes('Error') ? 'var(--danger)' : 'var(--accent)',
          fontWeight: 600, marginTop: 12, textAlign: 'center',
        }}>
          {status}
        </div>
      )}
    </form>
  )
}
