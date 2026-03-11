export default function Pricing() {
  const plans = [
    {
      name: 'Bàsic',
      price: 'Gratis',
      desc: 'Ideal per començar a tenir presència a l\'app.',
      features: [
        'Perfil bàsic del bar',
        'Apareix al mapa',
        'Horaris d\'obertura',
        '1 foto del local'
      ],
      cta: 'Començar gratis',
      highlight: false
    },
    {
      name: 'Pro',
      price: '29€/mes',
      desc: 'Per a bars que volen atraure més culers.',
      features: [
        'Tot el del pla Bàsic',
        'Insígnia de "Local Verificat"',
        'Publica ofertes i promocions',
        'Fins a 10 fotos',
        'Destacat en cerques properes'
      ],
      cta: 'Provar 14 dies gratis',
      highlight: true
    },
    {
      name: 'Premium',
      price: '79€/mes',
      desc: 'La solució completa per omplir el teu local.',
      features: [
        'Tot el del pla Pro',
        'Estadístiques d\'afluència',
        'Notificacions push als usuaris propers',
        'Suport prioritari',
        'Sense anuncis de la competència'
      ],
      cta: 'Contactar vendes',
      highlight: false
    }
  ]

  return (
    <section id="preus" style={{padding: '0 0 80px'}}>
      <div style={{textAlign: 'center', marginBottom: 48}}>
        <h2 style={{fontSize: 36, marginBottom: 16, color: '#fff'}}>Plans per a Bars</h2>
        <p style={{color: 'rgba(255,255,255,0.7)', fontSize: 18, maxWidth: 600, margin: '0 auto'}}>Tria el pla que millor s'adapti a les necessitats del teu negoci i comença a atraure més aficionats del Barça.</p>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, alignItems: 'center'}}>
        {plans.map((plan, i) => (
          <div key={i} style={{
            background: plan.highlight ? 'var(--blue)' : 'var(--card)',
            color: plan.highlight ? '#fff' : 'var(--text)',
            borderRadius: 24,
            padding: 40,
            border: plan.highlight ? 'none' : '1px solid var(--border)',
            boxShadow: plan.highlight ? '0 20px 40px rgba(0, 77, 152, 0.2)' : '0 4px 12px rgba(0,0,0,0.05)',
            transform: plan.highlight ? 'scale(1.05)' : 'scale(1)',
            position: 'relative'
          }}>
            {plan.highlight && <div style={{position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--gold)', color: 'var(--text)', padding: '4px 12px', borderRadius: 999, fontSize: 14, fontWeight: 'bold'}}>Més popular</div>}
            <h3 style={{fontSize: 24, marginBottom: 8, color: plan.highlight ? '#fff' : 'var(--text)'}}>{plan.name}</h3>
            <div style={{fontSize: 40, fontWeight: 800, marginBottom: 16}}>{plan.price}</div>
            <p style={{color: plan.highlight ? '#c0d4e8' : 'var(--muted)', marginBottom: 32, minHeight: 48}}>{plan.desc}</p>
            
            <ul style={{listStyle: 'none', padding: 0, margin: '0 0 40px 0'}}>
              {plan.features.map((feat, j) => (
                <li key={j} style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, color: plan.highlight ? '#fff' : 'var(--text)'}}>
                  <span style={{color: plan.highlight ? 'var(--gold)' : 'var(--accent)'}}>✓</span>
                  {feat}
                </li>
              ))}
            </ul>

            <a href="/registra-bar" style={{
              display: 'block',
              textAlign: 'center',
              background: plan.highlight ? 'var(--gold)' : '#fff',
              color: plan.highlight ? 'var(--blue)' : 'var(--accent)',
              padding: '16px',
              borderRadius: 12,
              fontWeight: 'bold',
              textDecoration: 'none',
              transition: 'transform 0.2s'
            }}>{plan.cta}</a>
          </div>
        ))}
      </div>
    </section>
  )
}