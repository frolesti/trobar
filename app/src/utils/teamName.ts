export function formatTeamNameForDisplay(raw: string | any): string {
    let nameStr = '';
    
    if (typeof raw === 'object' && raw !== null) {
        nameStr = raw.shortName || raw.name || raw.tla || '';
    } else {
        nameStr = String(raw || '');
    }

    const name = nameStr.trim().replace(/\s+/g, ' ');
    if (!name) return '';
  
    // Netejar la nostra nomenclatura interna per a visualització
    let clean = name
        .replace(/\(Fem\)/g, '')
        .replace(/ Women/gi, '')
        .trim();

    // Molts clubs alemanys es diuen oficialment "1. FC ..." (el "1." inicial no és un índex de llista).
    // Als pickers de la UI pot semblar una numeració, així que amaguem aquest prefix.
    clean = clean.replace(/^1\.\s*FC\s*/i, 'FC ');
    
    return clean;
}
