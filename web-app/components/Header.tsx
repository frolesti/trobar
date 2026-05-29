import Link from 'next/link'
import { useState, useEffect } from 'react'
import Logo from './Logo'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="site-header" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 1000,
      overflow: 'visible',
      padding: '20px 48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: scrolled ? 'rgba(12,12,12,0.9)' : 'linear-gradient(180deg, rgba(8,8,8,0.88) 0%, rgba(8,8,8,0.58) 62%, rgba(8,8,8,0) 100%)',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--hairline)' : '1px solid transparent',
      transition: 'background .4s ease, border-color .4s ease',
    }}>
      <Link href="/" aria-label="troBar — inici" style={{ display: 'flex' }}>
        <Logo size={38} variant="red" />
      </Link>

      <nav className="site-header-nav" style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Link href="/#qui-som" style={{
          color: 'var(--cream-70)',
          fontFamily: 'var(--font-body)',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}>
          Qui som
        </Link>
        <Link href="/#com-funciona" style={{
          color: 'var(--cream-70)',
          fontFamily: 'var(--font-body)',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}>
          Com funciona
        </Link>
        <Link href="/#caracteristiques" style={{
          color: 'var(--cream-70)',
          fontFamily: 'var(--font-body)',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}>
          Funcions
        </Link>
        <Link href="/#descarrega" style={{
          color: 'var(--cream-70)',
          fontFamily: 'var(--font-body)',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}>
          Descarrega
        </Link>
        <Link href="/per-a-bars" className="btn site-header-cta" style={{ padding: '10px 24px' }}>
          Ets un bar?
        </Link>
      </nav>
    </header>
  )
}
