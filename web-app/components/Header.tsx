import Link from 'next/link'
import { useState, useEffect } from 'react'
import Logo from './Logo'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMenuOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
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

      <button
        type="button"
        className="site-header-burger"
        aria-label={menuOpen ? 'Tancar menú' : 'Obrir menú'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(v => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className={`site-header-nav ${menuOpen ? 'open' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Link href="/#qui-som" onClick={() => setMenuOpen(false)} style={{
          color: 'var(--cream-70)',
          fontFamily: 'var(--font-body)',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}>
          Qui som
        </Link>
        <Link href="/#com-funciona" onClick={() => setMenuOpen(false)} style={{
          color: 'var(--cream-70)',
          fontFamily: 'var(--font-body)',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}>
          Com funciona
        </Link>
        <Link href="/#caracteristiques" onClick={() => setMenuOpen(false)} style={{
          color: 'var(--cream-70)',
          fontFamily: 'var(--font-body)',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}>
          Funcions
        </Link>
        <Link href="/#descarrega" onClick={() => setMenuOpen(false)} style={{
          color: 'var(--cream-70)',
          fontFamily: 'var(--font-body)',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}>
          Descarrega
        </Link>
        <Link href="/per-a-bars" onClick={() => setMenuOpen(false)} className="btn site-header-cta" style={{ padding: '10px 24px' }}>
          Ets un bar?
        </Link>
      </nav>
    </header>
  )
}
