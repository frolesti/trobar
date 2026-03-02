export function formatTeamNameForDisplay(raw: string | any): string {
    let nameStr = '';
    
    if (typeof raw === 'object' && raw !== null) {
        nameStr = raw.shortName || raw.name || raw.tla || '';
    } else {
        nameStr = String(raw || '');
    }

    const name = nameStr.trim().replace(/\s+/g, ' ');
    if (!name) return '';
  
    // Clean up our internal nomenclature for display
    let clean = name
        .replace(/\(Fem\)/g, '')
        .replace(/ Women/gi, '')
        .trim();

    // Many German clubs are officially named "1. FC ..." (the leading "1." is not a list index).
    // In UI pickers it can look like numbering, so we hide that prefix.
    clean = clean.replace(/^1\.\s*FC\s*/i, 'FC ');
    
    return clean;
}

export function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9\s-]/g, '') // remove special chars
        .trim()
        .replace(/\s+/g, '-');
}
