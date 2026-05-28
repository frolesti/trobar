/**
 * Re-export del contingut legal canònic.
 * La font de veritat viu a app/src/data/legalContent.ts perquè així
 * el mòbil (Metro) la consumeix directament dins del seu propi root.
 *
 * Aquí l'importem amb una ruta relativa estàndard — el tsconfig.json
 * del web-app inclou explícitament el fitxer perquè TypeScript el resolgui
 * tot i estar fora del rootDir. No cal cap alias.
 */
export { PRIVACY, TERMS } from '../../app/src/data/legalContent';
export type { LegalDoc, LegalSection, LegalBlock } from '../../app/src/data/legalContent';
