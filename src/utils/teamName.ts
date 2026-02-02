export function formatTeamNameForDisplay(raw: string): string {
  const name = (raw || '').trim().replace(/\s+/g, ' ');
  if (!name) return '';

  // Many German clubs are officially named "1. FC ..." (the leading "1." is not a list index).
  // In UI pickers it can look like numbering, so we hide that prefix.
  // Examples:
  // - "1. FC Union Berlin" -> "FC Union Berlin"
  // - "1.FC Köln" -> "FC Köln"
  return name.replace(/^1\.\s*FC\s*/i, 'FC ');
}
