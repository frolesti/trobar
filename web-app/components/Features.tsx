export default function Features() {
  const items = [
    {
      title: 'Mapa interactiu',
      desc: 'Visualitza tots els bars propers que emeten el partit en un mapa en temps real.',
      icon: (
        <svg width="34" height="34" viewBox="0 0 48 48">
          <defs><linearGradient id="fPin" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff4081"/><stop offset="100%" stopColor="#a50044"/></linearGradient></defs>
          <path d="M24 2C15.16 2 8 9.16 8 18c0 12 16 28 16 28s16-16 16-28C40 9.16 32.84 2 24 2z" fill="url(#fPin)" opacity="0.9"/>
          <circle cx="24" cy="18" r="5" fill="#fff" opacity="0.9"/>
        </svg>
      ),
      accent: '#a50044',
      bg: 'rgba(165,0,68,0.14)',
      borderColor: '#a50044',
    },
    {
      title: 'Locals verificats',
      desc: 'Horaris reals, fotos del local i equipament confirmat. Sense sorpreses.',
      icon: (
        <svg width="34" height="34" viewBox="0 0 48 48">
          <defs><linearGradient id="fCheck" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3da5ff"/><stop offset="100%" stopColor="#004d98"/></linearGradient></defs>
          <circle cx="24" cy="24" r="20" fill="url(#fCheck)" opacity="0.9"/>
          <polyline points="15,24 22,31 34,17" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      accent: '#004d98',
      bg: 'rgba(0,77,152,0.14)',
      borderColor: '#004d98',
    },
    {
      title: 'Partits i horaris',
      desc: 'Calendari complet del Barça. Descobreix quins bars emeten cada partit.',
      icon: (
        <svg width="34" height="34" viewBox="0 0 48 48">
          <defs><linearGradient id="fCal" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffd54f"/><stop offset="100%" stopColor="#edbb00"/></linearGradient></defs>
          <rect x="6" y="8" width="36" height="34" rx="6" fill="url(#fCal)" opacity="0.9"/>
          <rect x="6" y="8" width="36" height="12" rx="6" fill="#e6a800" opacity="0.4"/>
          <line x1="16" y1="4" x2="16" y2="12" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.8"/>
          <line x1="32" y1="4" x2="32" y2="12" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.8"/>
          <circle cx="18" cy="30" r="3" fill="#1a1a2e" opacity="0.5"/>
          <circle cx="30" cy="30" r="3" fill="#1a1a2e" opacity="0.5"/>
        </svg>
      ),
      accent: '#edbb00',
      bg: 'rgba(237,187,0,0.15)',
      borderColor: '#edbb00',
    },
    {
      title: 'Comunitat culer',
      desc: 'Afegeix bars nous i fes créixer el mapa. Cada culer compta.',
      icon: (
        <svg width="34" height="34" viewBox="0 0 48 48">
          <defs><linearGradient id="fPeople" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff6b9d"/><stop offset="100%" stopColor="#d4005a"/></linearGradient></defs>
          <circle cx="18" cy="14" r="7" fill="url(#fPeople)" opacity="0.85"/>
          <circle cx="34" cy="14" r="5" fill="url(#fPeople)" opacity="0.55"/>
          <path d="M4 40c0-8 6-14 14-14s14 6 14 14" fill="url(#fPeople)" opacity="0.75"/>
          <path d="M30 40c0-6 3-10 8-10s6 4 6 10" fill="url(#fPeople)" opacity="0.45"/>
        </svg>
      ),
      accent: '#db0030',
      bg: 'rgba(219,0,48,0.12)',
      borderColor: '#db0030',
    },
  ]

  return (
    <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
      {items.map((it, i) => (
        <div key={i} style={{
          padding: '36px 30px',
          display: 'flex', gap: 20, alignItems: 'center',
          background: '#004d98', borderRadius: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {it.icon}
          </div>
          <div>
            <h3 style={{ fontSize: 19, marginBottom: 8, color: '#fff', fontWeight: 700 }}>{it.title}</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, fontSize: 15, margin: 0 }}>{it.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
