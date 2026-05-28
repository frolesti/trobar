/**
 * Característiques editorial: sense icones, només tipografia.
 * Una majúscula gran italica fa de marc per a cada bloc.
 */
export default function Features() {
  const items = [
    { mark: 'M', title: 'Mapa interactiu',
      desc: 'Visualitza tots els bars propers que emeten el partit en un mapa en temps real.' },
    { mark: 'V', title: 'Locals verificats',
      desc: 'Horaris reals, fotos del local i equipament confirmat. Sense sorpreses.' },
    { mark: 'H', title: 'Partits i horaris',
      desc: 'Calendari complet del Barça. Descobreix quins bars emeten cada partit.' },
    { mark: 'C', title: 'Comunitat culer',
      desc: 'Afegeix bars nous i fes créixer el mapa. Cada culer compta.' },
  ]

  return (
    <div className="two-col-grid" style={{
      display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1,
      background: 'var(--hairline)',
      border: '1px solid var(--hairline)',
    }}>
      {items.map((it, i) => (
        <div key={i} style={{
          padding: '44px 36px',
          display: 'flex', gap: 28, alignItems: 'flex-start',
          background: 'rgba(13,27,42,0.18)',
          backdropFilter: 'blur(6px)',
        }}>
          <span style={{
            fontFamily: 'Lora, serif',
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: 80,
            lineHeight: 0.8,
            color: 'var(--gold)',
            flexShrink: 0,
            marginTop: 6,
          }} aria-hidden>
            {it.mark}
          </span>
          <div>
            <h3 style={{ marginBottom: 10 }}>{it.title}</h3>
            <p style={{ margin: 0, fontSize: 16 }}>{it.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
