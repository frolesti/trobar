export type AuthActionClient = {
  verifyPasswordResetCode: (code: string) => Promise<string>
  confirmPasswordReset: (code: string, password: string) => Promise<void>
  applyActionCode: (code: string) => Promise<void>
  validatePassword: (password: string) => Promise<boolean>
}

export type PreparedAction =
  | { kind: 'verified' }
  | { kind: 'reset'; email: string; complete: (password: string) => Promise<void> }

export function authActionMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  switch (code) {
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
    case 'auth/user-disabled':
    case 'auth/user-not-found':
      return 'Aquest enllaç ha caducat o ja no és vàlid. Demana un correu nou des de l’app.'
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'La contrasenya no compleix els requisits del compte. Fes-la més llarga i combina majúscules, minúscules, números i símbols.'
    case 'auth/network-request-failed':
      return 'No hem pogut connectar. Comprova la connexió i torna-ho a provar.'
    case 'auth/too-many-requests':
      return 'Hi ha hagut massa intents. Espera una estona abans de tornar-ho a provar.'
    default:
      return 'No hem pogut completar aquesta acció. Torna-ho a provar o demana un correu nou des de l’app.'
  }
}

export async function prepareAuthAction(params: URLSearchParams, client: AuthActionClient): Promise<PreparedAction> {
  const mode = params.get('mode')
  const code = params.get('oobCode')
  if (params.getAll('mode').length !== 1 || params.getAll('oobCode').length !== 1 ||
    !code || code.length > 2048 || !['resetPassword', 'verifyEmail'].includes(mode || '')) {
    throw { code: 'auth/invalid-action-code' }
  }
  // Use only the configured Firebase project; never URL-supplied keys or redirects.
  if (mode === 'verifyEmail') {
    await client.applyActionCode(code)
    return { kind: 'verified' }
  }
  const email = await client.verifyPasswordResetCode(code)
  let completion: Promise<void> | null = null
  return {
    kind: 'reset', email,
    complete: password => {
      if (completion) return completion
      completion = (async () => {
        if (password.length < 8 || !await client.validatePassword(password)) {
          throw { code: 'auth/password-does-not-meet-requirements' }
        }
        await client.confirmPasswordReset(code, password)
      })().catch(error => {
        completion = null
        throw error
      })
      return completion
    },
  }
}
