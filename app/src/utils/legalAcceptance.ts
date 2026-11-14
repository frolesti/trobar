import { LEGAL_VERSIONS } from '../data/legalContent';
import { LegalAcceptance } from '../models/UserProfile';

export function hasCurrentLegalAcceptance(acceptance: LegalAcceptance | undefined): boolean {
    return acceptance?.termsVersion === LEGAL_VERSIONS.terms &&
        acceptance.privacyVersion === LEGAL_VERSIONS.privacy &&
        acceptance.termsRead === true && acceptance.privacyRead === true &&
        typeof acceptance.acceptedAt?.toMillis === 'function' && acceptance.acceptedAt.toMillis() > 0;
}

export function canAcceptLegalDocuments(read: Record<'terms' | 'privacy', boolean>, accepted: Record<'terms' | 'privacy', boolean>): boolean {
    return read.terms && read.privacy && accepted.terms && accepted.privacy;
}
