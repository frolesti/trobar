import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { onIdTokenChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { recordFirstWebLogin, recordWebAccountSecurity } from '../lib/lifecycleEmail'
import '../styles/globals.css'

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
  return <Component {...pageProps} />
}
