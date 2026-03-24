import Link from 'next/link'
import { useState, useEffect } from 'react'
import Logo from './Logo'

export default function Header() {
  const [isHidden, setIsHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40)
      const footer = document.querySelector('footer')
      if (footer) {
        const footerRect = footer.getBoundingClientRect()
        setIsHidden(footerRect.top < window.innerHeight)
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1200,
      padding: '14px 24px',
      background: scrolled ? 'rgba(11,26,50,0.95)' : 'rgba(11,26,50,0.7)',
      backdropFilter: 'blur(20px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      transition: 'all 0.4s ease',
      opacity: isHidden ? 0 : 1,
      pointerEvents: isHidden ? 'none' : 'auto',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          textDecoration: 'none', color: '#fff',
        }}>
          <Logo size={30} color="#fff" />
          <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Lora, serif', letterSpacing: -0.5 }}>troBar</span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link href="/#com-funciona" style={{
            color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 14, fontWeight: 500,
            transition: 'color 0.2s',
          }}>
            Com funciona
          </Link>
          <Link href="/per-a-bars" style={{
            padding: '10px 22px', borderRadius: 12,
            background: '#a50044',
            color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none',
            border: 'none',
            boxShadow: '0 4px 16px rgba(165,0,68,0.3)',
            transition: 'all 0.3s',
          }}>
            Ets un bar?
          </Link>
        </nav>
      </div>
    </header>
  )
}
