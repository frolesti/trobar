import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useEffect } from 'react'
import { onIdTokenChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { recordFirstWebLogin, recordWebAccountSecurity } from '../lib/lifecycleEmail'
import colors from '../../app/src/theme/brandColors.json'
import palette from '../../brand/palette.json'
import '../styles/globals.css'

const variables = {
  '--brand-grana': colors.background,
  '--brand-accent': colors.primary,
  ...Object.fromEntries(Object.entries(palette).map(([name, value]) => [`--brand-${name}`, value])),
  '--brand-paper': palette.cream,
}

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => onIdTokenChanged(auth, user => {
    if (!user?.emailVerified) return
    void recordWebAccountSecurity().catch(error => {
      console.error('[Email] No s’ha pogut comprovar la seguretat del compte', error instanceof Error ? error.name : 'unknown')
    })
    void recordFirstWebLogin().catch(error => {
      console.error('[Email] No s’ha pogut registrar la benvinguda', error instanceof Error ? error.name : 'unknown')
    })
  }), [])
  return <>
    <Head><style key="brand-palette">{`:root{${Object.entries(variables).map(([key, value]) => `${key}:${value}`).join(';')}}`}</style></Head>
    <Component {...pageProps} />
  </>
}
