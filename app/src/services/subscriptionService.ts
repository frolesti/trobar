/* ═══════════════════════════════════════════════════════════════════════════
   subscriptionService.ts — Gestió de subscripcions amb Stripe
   ═══════════════════════════════════════════════════════════════════════════ */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export type BillingCycle = 'monthly' | 'quarterly' | 'annual';

export interface SubscriptionStatus {
    active: boolean;
    status?: string;
    billingCycle: BillingCycle | null;
    trialEnd: number | null;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd?: boolean;
}

export interface CheckoutResult {
    sessionId: string;
    url: string;
}

export interface ChangeCycleResult {
    ok: boolean;
    newCycle: string;
    currentPeriodEnd: number;
}

export const BILLING_PLANS = {
    monthly:   { label: 'Mensual',    price: 39, priceLabel: '39€/mes', totalLabel: '39€/mes',             save: null,    saveYear: 0 },
    quarterly: { label: 'Trimestral', price: 33, priceLabel: '33€/mes', totalLabel: '99€ cada 3 mesos',    save: '-15%',  saveYear: 72 },
    annual:    { label: 'Anual',      price: 29, priceLabel: '29€/mes', totalLabel: '348€/any',             save: '-25%',  saveYear: 120 },
} as const;

/**
 * Crea una sessió de Stripe Checkout per iniciar la subscripció
 */
export async function createCheckoutSession(billingCycle: BillingCycle): Promise<CheckoutResult> {
    const fn = httpsCallable<
        { billingCycle: string; successUrl: string; cancelUrl: string },
        CheckoutResult
    >(functions, 'createCheckoutSession');

    const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'https://trobar-app.cat';

    const result = await fn({
        billingCycle,
        successUrl: `${currentUrl}/bar-dashboard?checkout=success`,
        cancelUrl: `${currentUrl}/bar-dashboard?checkout=cancelled`,
    });

    return result.data;
}

/**
 * Canvia el cicle de facturació de la subscripció activa
 */
export async function changeBillingCycle(newCycle: BillingCycle): Promise<ChangeCycleResult> {
    const fn = httpsCallable<{ newCycle: string }, ChangeCycleResult>(
        functions, 'changeBillingCycle'
    );
    const result = await fn({ newCycle });
    return result.data;
}

/**
 * Cancel·la la subscripció de Stripe (per a eliminació de compte)
 */
export async function cancelSubscription(): Promise<{ ok: boolean; message: string }> {
    const fn = httpsCallable<Record<string, never>, { ok: boolean; message: string }>(
        functions, 'cancelSubscription'
    );
    const result = await fn({});
    return result.data;
}

/**
 * Obté l'estat actual de la subscripció
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const fn = httpsCallable<Record<string, never>, SubscriptionStatus>(
        functions, 'getSubscriptionStatus'
    );
    const result = await fn({});
    return result.data;
}

/**
 * Obre la sessió de checkout en una nova pestanya (web)
 */
export async function openCheckout(billingCycle: BillingCycle): Promise<void> {
    const { url } = await createCheckoutSession(billingCycle);
    if (url && typeof window !== 'undefined') {
        window.open(url, '_blank');
    }
}
