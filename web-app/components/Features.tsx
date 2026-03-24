export default function Features() {
  const items = [
    {
      title: 'Mapa interactiu',
      desc: 'Visualitza tots els bars propers que emeten el partit en un mapa en temps real. Filtra per ambient, pantalles o terrassa.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      ),
      accent: 'var(--accent)',
    },
    {
      title: 'Locals verificats',
      desc: 'Cada bar verificat mostra horaris reals, fotos del local i equipament confirmat pel propietari. Sense sorpreses.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      ),
      accent: 'var(--blue)',
    },
    {
      title: 'Partits i horaris',
      desc: 'Consulta el calendari complet del Barça i descobreix quins bars emeten cada partit amb un sol toc.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      ),
      accent: 'var(--gold)',
    },
    {
      title: 'Descobreix nous bars',
      desc: 'Escaneja qualsevol zona i afegeix bars que encara no hi són. La comunitat culer fa créixer el mapa cada dia.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      ),
      accent: 'var(--accent)',
    },
  ]

  return (
    <section className="features-section" style={{ padding: '56px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
        {items.map((it, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(12px)',
            borderRadius: 20,
            padding: '32px 28px',
            border: '1px solid rgba(255,255,255,0.10)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: `${it.accent}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20, color: it.accent,
            }}>
              {it.icon}
            </div>
            <h3 style={{ fontSize: 20, marginBottom: 10, color: '#fff' }}>{it.title}</h3>
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, fontSize: 15, margin: 0 }}>{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
