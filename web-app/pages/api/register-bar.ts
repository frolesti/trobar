import type { NextApiRequest, NextApiResponse } from 'next'

type Data = {
  ok: boolean
  message?: string
  error?: string
  barId?: string
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  const { businessName, nif, contactEmail, password } = req.body

  // Validació bàsica
  if (!businessName || !nif || !contactEmail || !password) {
    return res.status(400).json({ ok: false, error: 'Falten camps obligatoris' })
  }

  // Aquí aniria la lògica real de base de dades (ex: Firebase Auth + Firestore)
  // 1. Crear usuari a Firebase Auth amb email i password
  // 2. Assignar un custom claim { role: 'bar_owner' }
  // 3. Crear document a la col·lecció 'bars' amb les dades del local

  console.log('Simulant registre de bar:', { businessName, nif, contactEmail })

  // Simulem un retard de xarxa
  setTimeout(() => {
    res.status(200).json({ 
      ok: true, 
      message: 'Compte de bar creat correctament',
      barId: 'bar_' + Math.random().toString(36).substr(2, 9)
    })
  }, 1000)
}
