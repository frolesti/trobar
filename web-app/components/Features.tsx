/**
 * Característiques: només títol + descripció. Sense lletres decoratives
 * ni icones inventades — la tipografia única ja porta tot el pes visual.
 */
export default function Features() {
  const items = [
    { title: 'Mapa interactiu',
      desc: 'Visualitza tots els bars propers que emeten el partit en un mapa en temps real.' },
    { title: 'Locals verificats',
      desc: 'Horaris reals, fotos del local i equipament confirmat. Sense sorpreses.' },
    { title: 'Partits i horaris',
      desc: 'Calendari complet del Barça. Descobreix quins bars emeten cada partit.' },
    { title: 'Comunitat culer',
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
          background: 'rgba(13,27,42,0.28)',
          backdropFilter: 'blur(6px)',
        }}>
          <h3 style={{ marginBottom: 10 }}>{it.title}</h3>
          <p style={{ margin: 0, fontSize: 16 }}>{it.desc}</p>
        </div>
      ))}
    </div>
  )
}
