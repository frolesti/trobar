import Link from 'next/link'
import { useState, useEffect } from 'react'
import Logo from './Logo'
import Wordmark from './Wordmark'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 900) setMenuOpen(false)
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
      background: 'var(--brand-cream)',
      borderBottom: scrolled ? '1px solid var(--brand-rule)' : '1px solid transparent',
      transition: 'background .4s ease, border-color .4s ease',
    }}>
      <Link href="/" aria-label="troBar — inici" className="site-header-brand">
        <span className="site-header-lockup">
          <Logo size={40} visualScale={1} variant="red" maskCircle={false} />
          <Wordmark width={76} decorative />
        </span>
      </Link>

      <button
        type="button"
        className="site-header-burger"
        aria-label={menuOpen ? 'Tancar menú' : 'Obrir menú'}
        aria-expanded={menuOpen}
        aria-controls="site-navigation"
        onClick={() => setMenuOpen(v => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav id="site-navigation" className={`site-header-nav ${menuOpen ? 'open' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
