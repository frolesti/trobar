import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ca">
      <Head>
        {/* Favicon i icona iOS amb el logo real de troBar */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/trobar-logo-round.png" />
        <meta name="theme-color" content="#a50044" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
