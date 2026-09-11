/**
 * Two letters standing in for a face.
 *
 * Names arrive in ten scripts, so this takes whole characters rather than
 * slicing bytes — `slice(0, 1)` on an emoji or an astral-plane character cuts a
 * surrogate pair in half and renders the replacement glyph.
 *
 * Shared by the Account panel, the Plus tab and the forum, so the same person
 * gets the same two letters everywhere.
 */
const initialsOf = (
  name: string | undefined,
  fallback: string | undefined,
): string => {
  const source = (name ?? fallback ?? '').trim();
  if (!source) {
    return '';
  }
  const words = source.split(/\s+/).filter(Boolean);
  const first = [...(words[0] ?? '')][0] ?? '';
  const second = words.length > 1 ? ([...words[1]][0] ?? '') : '';
  return (first + second).toUpperCase();
};

export default initialsOf;
