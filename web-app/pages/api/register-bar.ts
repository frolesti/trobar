import type { NextApiRequest, NextApiResponse } from 'next'

// Per activar Stripe real:
// 1. npm install stripe
// 2. Afegir STRIPE_SECRET_KEY al .env.local
// 3. Crear productes i preus al Dashboard de Stripe
// 4. Descomentar les línies marcades amb [STRIPE]

// [STRIPE] import Stripe from 'stripe'
// [STRIPE] const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })

const PRICE_IDS: Record<string, string> = {
  // Substituir pels IDs reals de Stripe
  price_pro_monthly: 'price_XXXXXXXXXXXXXXXX',
  price_premium_monthly: 'price_YYYYYYYYYYYYYYYY',
}

type Data = {
  ok: boolean
  message?: string
  error?: string
  barId?: string
  checkoutUrl?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  const {
    businessName, address, city, postalCode, phone, website,
    nif, legalName,
    contactName, contactEmail, contactPhone, password,
    capacity, screens, openingHours, description,
    plan, acceptTerms,
  } = req.body

  // Validació bàsica
  if (!businessName || !address || !city || !postalCode || !nif || !contactName || !contactEmail || !password) {
    return res.status(400).json({ ok: false, error: 'Falten camps obligatoris' })
  }

  if (!acceptTerms) {
    return res.status(400).json({ ok: false, error: 'Has d\'acceptar les condicions' })
  }

  if (password.length < 8) {
    return res.status(400).json({ ok: false, error: 'La contrasenya ha de tenir mínim 8 caràcters' })
  }

  const barId = 'bar_' + Math.random().toString(36).substr(2, 9)

  console.log('Registre de bar:', {
    barId, businessName, address, city, postalCode, phone, website,
    nif, legalName, contactName, contactEmail, contactPhone,
    capacity, screens, openingHours, description, plan,
  })

  // Aquí aniria la lògica real de base de dades:
  // 1. Crear usuari a Firebase Auth amb email i password
  // 2. Assignar custom claim { role: 'bar_owner' }
  // 3. Crear document a 'bars' i 'barOwners' col·leccions

  // Si el pla requereix pagament → crear sessió Stripe Checkout
  if (plan !== 'basic') {
    const priceId = plan === 'pro' ? PRICE_IDS.price_pro_monthly : PRICE_IDS.price_premium_monthly

    // [STRIPE] Descomentar quan Stripe estigui configurat:
    /*
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: contactEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.headers.origin}/registra-bar?success=true&barId=${barId}`,
      cancel_url: `${req.headers.origin}/registra-bar?cancelled=true`,
      metadata: { barId, businessName, nif, contactEmail },
    })
    return res.status(200).json({ ok: true, barId, checkoutUrl: session.url! })
    */

    // Mode simulació — retorna URL fictícia
    console.log(`[STRIPE SIMULAT] Pla ${plan}, priceId: ${priceId}, email: ${contactEmail}`)
    return res.status(200).json({
      ok: true,
      message: `Compte creat (pla ${plan}). En producció, es redirigiria a Stripe Checkout.`,
      barId,
      // checkoutUrl: 'https://checkout.stripe.com/...' ← en producció
    })
  }

  // Pla gratuït — registre directe
  return res.status(200).json({
    ok: true,
    message: 'Compte de bar creat correctament (pla gratuït)',
    barId,
  })
}
