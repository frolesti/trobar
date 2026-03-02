export default function Features() {
  const items = [
    { title: 'Mapa en temps real', desc: 'Troba bars a prop teu que retransmeten el partit amb informació de l\'ambient en directe.' },
    { title: 'Locals verificats', desc: 'Els propietaris registren i verifiquen els detalls perquè tinguis horaris i ofertes precises.' },
    { title: 'Preferits i alertes', desc: 'Guarda els teus bars preferits i rep notificacions sobre promocions especials.' },
    { title: 'Valoracions de culers', desc: 'Llegeix ressenyes i descobreix l\'ambient gràcies a altres aficionats del Barça.' }
  ]

  return (
    <section className="features-section" style={{padding: '56px 0'}}>
      <div className="features-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '28px'}}>
        {items.map((it, i) => (
          <div key={i} className="feature-card" style={{background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}}>
            <h3 style={{fontSize: 20, marginBottom: 12, color: 'var(--text)'}}>{it.title}</h3>
            <p className="muted" style={{color: 'var(--muted)', lineHeight: 1.5}}>{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
