import Link from 'next/link'
import { useState, useEffect } from 'react'
import Logo from './Logo'

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
            <Logo size={40} />
            <span style={{fontSize: 24, fontWeight: 800, color: 'var(--text)', fontFamily: 'Lora, serif'}}>troBar</span>
          </Link>
        </div>

        <div className="header-right" style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <Link href="/per-a-bars" className="cta">Ets un bar?</Link>
        </div>
      </div>
    </header>
  )
}
