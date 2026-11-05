import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ca">
      <Head>
        {/* Favicon i icona iOS amb el logo real de troBar */}
        <link rel="icon" type="image/x-icon" sizes="16x16 32x32 48x48" href="/favicon.ico?v=1" />
        <link rel="icon" type="image/png" sizes="32x32" href="/assets/logos/favicon-32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/logos/apple-touch-icon.png" />
        <meta name="theme-color" content="#a50044" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
