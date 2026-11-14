/* ═══════════════════════════════════════════════════════════════════════════
   subscriptionService.ts — Gestió de subscripcions amb Stripe
   ═══════════════════════════════════════════════════════════════════════════ */

import { httpsCallable } from 'firebase/functions';
import { Linking, Platform } from 'react-native';
import { openBrowserAsync } from 'expo-web-browser';
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
    newCycle: BillingCycle;
    currentPeriodEnd: number | null;
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
        { billingCycle: string },
        CheckoutResult
    >(functions, 'createCheckoutSession');

    const result = await fn({
        billingCycle,
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
    if (!result.data.ok || result.data.newCycle !== newCycle) {
        throw new Error('SUBSCRIPTION_CHANGE_NOT_CONFIRMED');
    }
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
    if (!url || !/^https:\/\/checkout\.stripe\.com\//.test(url)) {
        throw new Error('SUBSCRIPTION_CHECKOUT_UNAVAILABLE');
    }
    await Linking.openURL(url);
}

export async function openBillingPortal(): Promise<void> {
    const portalWindow = Platform.OS === 'web' ? window.open('about:blank', '_blank') : null;
    if (Platform.OS === 'web' && !portalWindow) {
        throw Object.assign(new Error('SUBSCRIPTION_PORTAL_POPUP_BLOCKED'), { code: 'billing/popup-blocked' });
    }
    if (portalWindow) portalWindow.opener = null;
    try {
        const create = httpsCallable<Record<string, never>, { url: string }>(
            functions, 'createBillingPortalSession'
        );
        const result = await create({});
        const url = result.data?.url;
        // React Native's URL polyfill does not implement origin or credentials.
        if (typeof url !== 'string' || url !== url.trim()
            || !/^https:\/\/billing\.stripe\.com\/[^\s\\\u0000-\u001f\u007f-\u009f]*$/u.test(url)) {
            throw new Error('SUBSCRIPTION_PORTAL_UNAVAILABLE');
        }
        if (portalWindow) {
            if (portalWindow.closed) throw new Error('SUBSCRIPTION_PORTAL_WINDOW_CLOSED');
            portalWindow.location.replace(url);
        } else {
            await openBrowserAsync(url);
        }
    } catch (error) {
        if (portalWindow && !portalWindow.closed) portalWindow.close();
        throw error;
    }
}
