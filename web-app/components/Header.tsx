import Link from 'next/link'
import { useState, useEffect } from 'react'
import Brand from './Brand'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40)
      const footer = document.querySelector('footer')
      if (footer) {
        const rect = footer.getBoundingClientRect()
        setHidden(rect.top < window.innerHeight - 80)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 1200,
      padding: '18px 24px',
      background: scrolled
        ? 'linear-gradient(180deg, rgba(13,27,42,0.55) 0%, rgba(13,27,42,0.0) 100%)'
        : 'transparent',
      backdropFilter: scrolled ? 'blur(14px) saturate(1.2)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(14px) saturate(1.2)' : 'none',
      transition: 'all 0.4s ease',
      opacity: hidden ? 0 : 1,
      pointerEvents: hidden ? 'none' : 'auto',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16,
      }}>
        <Brand size={26} showLeadLogo dotColor="var(--gold)" />

        <nav style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <Link href="/#com-funciona" style={{
            color: 'var(--paper-mute)', fontSize: 14, fontStyle: 'italic',
            letterSpacing: 0.5,
          }}>
            Com funciona
          </Link>
          <Link href="/per-a-bars" className="btn-ghost" style={{ padding: '10px 22px', fontSize: 14 }}>
            Ets un bar?
          </Link>
        </nav>
      </div>
    </header>
  )
}
