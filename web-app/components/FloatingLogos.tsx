import { useEffect, useState } from 'react'

/**
 * Animacions del troBar flotants creuant-se en direccions aleatòries
 * pel darrere del contingut. Pensat com a fons decoratiu (pointer-events: none).
 *
 * Per defecte renderitza el .webm transparent (animació oficial).
 * Si es passa `staticImage`, cau en el PNG estàtic com a fallback.
 */
interface FloatingLogosProps {
  count?: number
  variant?: 'red' | 'white'
  opacity?: number
  staticImage?: boolean
  fixed?: boolean
  zIndex?: number
}

interface Point {
  x: string
  y: string
}

interface LogoSpec {
  id: number
  size: number
  duration: number
  delay: number
  startRot: number
  midRot: number
  endRot: number
  p0: Point
  p1: Point
  p2: Point
  opacity: number
}

function createRng(seed: number) {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

function rand(rng: () => number, min: number, max: number) {
  return rng() * (max - min) + min
}

function pick<T>(rng: () => number, arr: T[]) {
  return arr[Math.floor(rng() * arr.length)]
}

type Edge = 'top' | 'right' | 'bottom' | 'left'

function edgePoint(rng: () => number, edge: Edge): Point {
  if (edge === 'top') {
    return { x: `${rand(rng, -10, 110).toFixed(2)}vw`, y: `${rand(rng, -18, -4).toFixed(2)}vh` }
  }
  if (edge === 'right') {
    return { x: `${rand(rng, 101, 116).toFixed(2)}vw`, y: `${rand(rng, -6, 106).toFixed(2)}vh` }
  }
  if (edge === 'bottom') {
    return { x: `${rand(rng, -10, 110).toFixed(2)}vw`, y: `${rand(rng, 101, 118).toFixed(2)}vh` }
  }
  return { x: `${rand(rng, -18, -4).toFixed(2)}vw`, y: `${rand(rng, -6, 106).toFixed(2)}vh` }
}

function opposite(edge: Edge): Edge {
  if (edge === 'top') return 'bottom'
  if (edge === 'right') return 'left'
  if (edge === 'bottom') return 'top'
  return 'right'
}

function buildSpecs(count: number, opacity: number, rng: () => number): LogoSpec[] {
  const edges: Edge[] = ['top', 'right', 'bottom', 'left']
  const cols = Math.max(2, Math.ceil(Math.sqrt(count)))
  const rows = Math.max(2, Math.ceil(count / cols))

  return Array.from({ length: count }, (_, i) => {
    const startEdge = edges[i % edges.length]
    const endEdge = rng() < 0.75 ? opposite(startEdge) : pick(rng, edges.filter(e => e !== startEdge))
    const duration = rand(rng, 8, 280)
    const row = Math.floor(i / cols)
    const col = i % cols
    const baseX = ((col + 0.5) / cols) * 100
    const baseY = ((row + 0.5) / rows) * 100
    const jitterX = rand(rng, -100 / cols, 100 / cols)
    const jitterY = rand(rng, -100 / rows, 100 / rows)
    let p1x = Math.max(4, Math.min(96, baseX + jitterX))
    let p1y = Math.max(4, Math.min(96, baseY + jitterY))

    // Evita que les rutes passin pel centre on hi ha el text principal.
    const inTitleSafeZone = p1x > 24 && p1x < 76 && p1y > 18 && p1y < 74
    if (inTitleSafeZone) {
      const pushX = p1x < 50 ? -rand(rng, 14, 24) : rand(rng, 14, 24)
      const pushY = p1y < 46 ? -rand(rng, 10, 18) : rand(rng, 10, 18)
      p1x = Math.max(4, Math.min(96, p1x + pushX))
      p1y = Math.max(4, Math.min(96, p1y + pushY))
    }

    return {
      id: i,
      size: Math.round(rand(rng, 170, 320)),
      duration,
      delay: -rand(rng, 0, duration * 0.85),
      startRot: rand(rng, -40, 40),
      midRot: rand(rng, -220, 220),
      endRot: rand(rng, -360, 360),
      p0: edgePoint(rng, startEdge),
      p1: { x: `${p1x.toFixed(2)}vw`, y: `${p1y.toFixed(2)}vh` },
      p2: edgePoint(rng, endEdge),
      opacity: rand(rng, opacity * 0.45, opacity),
    }
  })
}

function useRandomSpecs(count: number, opacity: number) {
  const [specs, setSpecs] = useState<LogoSpec[]>(() => {
    const seeded = createRng(1337 + count * 17 + Math.round(opacity * 1000))
    return buildSpecs(count, opacity, seeded)
  })

  useEffect(() => {
    setSpecs(buildSpecs(count, opacity, Math.random))

    // Re-randomitza cada cert temps perquè les rutes vagin canviant sense recarregar.
    const refresh = setInterval(() => {
      setSpecs(buildSpecs(count, opacity, Math.random))
    }, 60000)

    return () => clearInterval(refresh)
  }, [count, opacity])

  return { specs }
}

export default function FloatingLogos({
  count = 28,
  variant = 'red',
  opacity = 0.56,
  staticImage = false,
  fixed = false,
  zIndex = 0,
}: FloatingLogosProps) {
  const { specs } = useRandomSpecs(count, opacity)

  const imgSrc = variant === 'white' ? '/assets/logos/logo-white.png' : '/assets/logos/logo-red.png'
  const gifSrc = '/assets/gif/trobar.gif'

  return (
    <div
      aria-hidden="true"
      style={{
        position: fixed ? 'fixed' : 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex,
      }}
    >
      {specs.map(s => (
        <span
          key={s.id}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            animation: `floatLogo${s.id} ${s.duration}s linear ${s.delay}s infinite`,
            willChange: 'transform',
          }}
        >
          {staticImage ? (
            <img
              src={imgSrc}
              alt=""
              width={s.size}
              height={s.size}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <img
              src={gifSrc}
              alt=""
              width={s.size}
              height={s.size}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          )}
        </span>
      ))}
      <style>{specs.map(s => `
        @keyframes floatLogo${s.id} {
          0%   { transform: translate(${s.p0.x}, ${s.p0.y}) rotate(${s.startRot}deg); }
          50%  { transform: translate(${s.p1.x}, ${s.p1.y}) rotate(${s.midRot}deg); }
          100% { transform: translate(${s.p2.x}, ${s.p2.y}) rotate(${s.endRot}deg); }
        }
      `).join('\n')}</style>
    </div>
  )
}
