import { useEffect, useCallback } from 'react'
import { PRIVACY, TERMS, LegalDoc } from '../lib/legalContent'
import LegalBody from './LegalBody'

type LegalType = 'privacy' | 'terms'

interface LegalModalProps {
  type: LegalType
  onClose: () => void
}

/**
 * Modal legal mínim. Render unificat via LegalBody (que llegeix la dada
 * canònica de app/src/data/legalContent.ts).
 *
 * No té caixa blanca: panell traslúcid sobre el degradat del body, així
 * la pàgina no es trenca visualment.
 */
export default function LegalModal({ type, onClose }: LegalModalProps) {
  const doc: LegalDoc = type === 'privacy' ? PRIVACY : TERMS

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onKey])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(13,27,42,0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'lmFadeIn 0.25s ease-out',
      }}
    >
      <style>{`
        @keyframes lmFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lmSlideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%', maxWidth: 720,
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: '56px 48px 48px',
          background: 'linear-gradient(180deg, rgba(13,27,42,0.55), rgba(13,27,42,0.85))',
          border: '1px solid var(--hairline)',
          color: 'var(--paper)',
          animation: 'lmSlideUp 0.3s ease-out',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Tancar"
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'transparent', border: '1px solid var(--hairline)',
            color: 'var(--paper)',
            width: 36, height: 36,
            cursor: 'pointer',
            fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1,
          }}
        >
          ✕
        </button>
        <LegalBody doc={doc} />
      </div>
    </div>
  )
}
