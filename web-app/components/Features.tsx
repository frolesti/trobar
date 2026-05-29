const items = [
  {
    title: 'Mapa en temps real',
    desc:  'Veu quins bars propers emeten el partit avui. Filtrat per zona i actualitzat per la comunitat.',
  },
  {
    title: 'Confirmat per culers',
    desc:  'Cada barra és afegida i verificada per usuaris reals. Sense sorpreses el dia del partit.',
  },
  {
    title: 'Calendari del Barça',
    desc:  'Tots els partits de la temporada integrats. Saps quan i on mirar sense buscar res.',
  },
  {
    title: 'Comunitat activa',
    desc:  'Afegeix bars nous, confirma horaris i fes créixer el mapa. Cada culer hi contribueix.',
  },
]

export default function Features() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '1px',
      background: 'var(--hairline)',
      border: '1px solid var(--hairline)',
    }} className="split-grid">
      {items.map((it, i) => (
        <div key={i} style={{
          padding: '52px 48px',
          background: 'var(--dark)',
        }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 10,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            margin: '0 0 20px',
          }}>
            {String(i + 1).padStart(2, '0')}
          </p>
          <h3 style={{ marginBottom: 16, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22 }}>
            {it.title}
          </h3>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7 }}>{it.desc}</p>
        </div>
      ))}
    </div>
  )
}
