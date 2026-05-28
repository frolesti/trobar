import { LegalDoc } from '../lib/legalContent'

interface LegalBodyProps {
  doc: LegalDoc
}

/**
 * Renderer compartit entre /politica-privacitat, /termes-condicions
 * i LegalModal. La dada ve sempre de la mateixa font canònica.
 *
 * Detecta emails al text i els converteix automàticament en enllaços mailto.
 */
export default function LegalBody({ doc }: LegalBodyProps) {
  return (
    <article style={{ maxWidth: 680, margin: '0 auto' }}>
      <p style={{
        fontFamily: 'Lora, serif', fontStyle: 'italic',
        color: 'var(--gold)', fontSize: 13, letterSpacing: 2,
        textTransform: 'uppercase', marginBottom: 12,
      }}>
        Legal
      </p>
      <h1 style={{ marginBottom: 8 }}>
        {doc.title} <em style={{ color: 'var(--gold)', fontWeight: 500 }}>{doc.titleAccent}</em>
      </h1>
      <p style={{
        color: 'var(--paper-faint)', fontStyle: 'italic',
        fontSize: 14, marginBottom: 40,
      }}>
        Última actualització — {doc.lastUpdated}
      </p>

      {doc.sections.map((section, i) => (
        <section key={i} style={{ marginBottom: 36 }}>
          <h3 style={{ marginBottom: 12, color: 'var(--paper)' }}>{section.title}</h3>
          {section.blocks.map((block, j) => {
            if (block.kind === 'p') {
              return (
                <p key={j} style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--paper-mute)' }}>
                  {renderInline(block.text)}
                </p>
              )
            }
            return (
              <ul key={j} className="legal">
                {block.items.map((item, k) => (
                  <li key={k}>{renderInline(item)}</li>
                ))}
              </ul>
            )
          })}
        </section>
      ))}
    </article>
  )
}

/* Converteix emails en enllaços mailto dins del text */
function renderInline(text: string): React.ReactNode {
  const splitter = /([\w.+-]+@[\w-]+\.[\w.-]+)/g
  const isEmail = /^[\w.+-]+@[\w-]+\.[\w.-]+$/
  const parts = text.split(splitter)
  return parts.map((part, i) =>
    isEmail.test(part)
      ? <a key={i} href={`mailto:${part}`} style={{ color: 'var(--gold)', borderBottom: '1px solid var(--gold)' }}>{part}</a>
      : <span key={i}>{part}</span>
  )
}
