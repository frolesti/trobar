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
    <>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1200,
        padding: '12px 24px',
        background: scrolled ? 'rgba(165,0,68,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        transition: 'all 0.3s ease',
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden ? 'none' : 'auto',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link href="/" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            textDecoration: 'none', color: '#fff',
          }}>
            <Logo size={32} color="#fff" />
            <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Lora, serif' }}>troBar</span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Link href="/#com-funciona" style={{
              color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontSize: 14, fontWeight: 500,
              transition: 'color 0.2s',
            }}>
              Com funciona
            </Link>
            <Link href="/per-a-bars" className="cta" style={{
              padding: '10px 20px', borderRadius: 999,
              background: 'rgba(255,255,255,0.12)', color: '#fff',
              fontWeight: 600, fontSize: 14, textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: 'none',
              transition: 'all 0.2s',
            }}>
              Ets un bar?
            </Link>
          </nav>
        </div>
      </header>
    </>
  )
}
