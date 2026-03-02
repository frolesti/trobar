import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function Header() {
  const [isHidden, setIsHidden] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const footer = document.querySelector('footer')
      if (footer) {
        const footerRect = footer.getBoundingClientRect()
        // Check if top of footer is within viewport
        if (footerRect.top < window.innerHeight) {
          setIsHidden(true)
        } else {
          setIsHidden(false)
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Initial check
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className="site-header" style={{
      opacity: isHidden ? 0 : 1,
      pointerEvents: isHidden ? 'none' : 'auto',
      transition: 'opacity 0.3s ease-in-out'
    }}>
      <div className="header-pill">
        <div className="header-left">
          <Link href="/" className="brand-link" style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <img src="/logo.png" alt="troBar" width="40" height="40" style={{borderRadius: '50%', objectFit: 'cover'}} />
            <span style={{fontSize: 24, fontWeight: 800, color: 'var(--text)', fontFamily: 'Lora, serif'}}>troBar</span>
          </Link>
        </div>

        <nav className="nav" style={{display: 'flex', gap: '24px', alignItems: 'center'}}>
          <Link href="/#intro" className="nav-link" style={{color: 'var(--text)', fontWeight: 600, textDecoration: 'none'}}>Intro</Link>
          <Link href="/#com-funciona" className="nav-link" style={{color: 'var(--text)', fontWeight: 600, textDecoration: 'none'}}>Com funciona</Link>
          <Link href="/#preus" className="nav-link" style={{color: 'var(--text)', fontWeight: 600, textDecoration: 'none'}}>Preus</Link>
        </nav>

        <div className="header-right">
          <Link href="/registra-bar" className="cta">Registra el teu bar</Link>
        </div>
      </div>
    </header>
  )
}
