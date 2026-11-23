import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

export async function recordWebAccountSecurity(): Promise<void> {
  const record = httpsCallable<void, { status: string }>(functions, 'recordAccountSecurity')
  const response = await record()
  if (!['recorded', 'suppressed'].includes(response.data?.status)) throw new Error('Invalid security observation status')
}

export async function recordFirstWebLogin(): Promise<void> {
  const record = httpsCallable<void, { status: string }>(functions, 'recordFirstLogin')
  const response = await record()
  if (!['queued', 'suppressed', 'unverified', 'not-new'].includes(response.data?.status)) {
    throw new Error('Invalid welcome email status')
  }
}
