import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ca">
      <Head>
        {/* Favicon i icona iOS amb el logo real de troBar */}
        <link rel="icon" type="image/png" href="/assets/logos/logo-red.png" />
        <link rel="apple-touch-icon" href="/assets/logos/logo-red.png" />
        <meta name="theme-color" content="#a50044" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
