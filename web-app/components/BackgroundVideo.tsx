type BackgroundVideoProps = {
  name: 'canopy' | 'glasses-beer' | 'community'
}

export default function BackgroundVideo({ name }: BackgroundVideoProps) {
  return (
    <video
      className="background-video"
      src={`/assets/videos/${name}.mp4`}
      poster={`/assets/img/${name}-poster.jpg`}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      onError={event => {
        console.error(`[BackgroundVideo] No s'ha pogut carregar ${name}.mp4`, event.currentTarget.error?.code)
      }}
    />
  )
}
