declare module 'next/link' {
  import * as React from 'react'
  const Link: React.ComponentType<any>
  export default Link
}

declare module 'next/image' {
  import * as React from 'react'
  const Image: React.ComponentType<any>
  export default Image
}

declare module '*.module.css' {
  const classes: { [key: string]: string }
  export default classes
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module 'next/head' {
  import * as React from 'react'
  const Head: React.ComponentType<any>
  export default Head
}

declare module 'next/app' {
  export type AppProps = any
}
