import React from 'react'

const logos = [
  '/press/martha.svg',
  '/press/newsweek.svg',
  '/press/verge.svg',
  '/press/mashable.svg',
  '/press/nyt.svg',
]

export default function PressStrip() {
  // duplicate logos list so the scroll can loop seamlessly
  const track = [...logos, ...logos]

  return (
    <div className="press-strip" aria-hidden>
      <div className="press-track">
        {track.map((src, idx) => (
          <div className="press-item" key={`${src}-${idx}`}>
            <img src={src} alt="press logo" className="press-logo" />
          </div>
        ))}
      </div>
    </div>
  )
}
