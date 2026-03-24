import type { NextApiRequest, NextApiResponse } from 'next'

/* ═══════════════════════════════════════════════════════════════════════════
   DEPRECATED — Aquesta ruta ja no s'utilitza.
   ─────────────────────────────────────────────────────────────────────────
   El registre de bars ara es fa via Firebase Cloud Functions
   directament des del frontend (httpsCallable → registerBar).
   ═══════════════════════════════════════════════════════════════════════════ */

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(410).json({
    error: 'Aquesta ruta està obsoleta. Utilitza la Cloud Function registerBar.',
  })
}
