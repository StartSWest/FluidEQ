/** Optional authoring metadata; never code and never included in a signed pack. */
export interface IArtworkRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
}

/**
 * A region's name: a letter, then letters, digits, - and _. Either case,
 * because the names are labels the scene's own code keeps for itself, and a
 * member's AI that packed by hand wrote `boatSloop` beside `bird0`.
 */
const REGION_ID = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;

/** The most regions one artwork lists; pack_artwork packs no more. */
const MAX_REGIONS = 64;

/** A listed entry's name, without case, for telling two apart. */
const nameOf = (value: unknown) => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { id } = value as Record<string, unknown>;
  return typeof id === 'string' ? id.toLowerCase() : undefined;
};

/**
 * Every region of `artworkRegions` that can be read, each entry judged on its
 * own. A name listed twice (told apart without case) says no one place, so
 * every entry carrying it is left out; a list longer than any pack holds is
 * not read at all.
 *
 * EACH ON ITS OWN. This used to answer every region or none, and one entry
 * it did not take emptied the list: the alpine scene listed 41 pieces, three
 * of them in camelCase, and pack_artwork then found none of them to keep
 * ("the artwork has no piece aurora") and took the whole image for one of
 * the member's photo places, kept whole - 4096 x 2048, every pixel an
 * artwork may have - so even one small bird "did not fit" (2026-11-09).
 */
export const readArtworkRegions = (
  raw: unknown,
  width: number,
  height: number,
): IArtworkRegion[] => {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    !Array.isArray(raw) ||
    raw.length > MAX_REGIONS
  ) {
    return [];
  }
  const names = raw.map(nameOf);
  const twice = new Set(
    names.filter((name, index) => names.indexOf(name) !== index),
  );
  return raw.flatMap((value: unknown) => {
    if (typeof value !== 'object' || value === null) {
      return [];
    }
    const {
      id,
      x,
      y,
      width: w,
      height: h,
      rotated,
    } = value as Record<string, unknown>;
    if (
      typeof id !== 'string' ||
      !REGION_ID.test(id) ||
      twice.has(id.toLowerCase()) ||
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof w !== 'number' ||
      typeof h !== 'number' ||
      ![x, y, w, h].every(Number.isInteger) ||
      x < 0 ||
      y < 0 ||
      w < 1 ||
      h < 1 ||
      x + w > width ||
      y + h > height
    ) {
      return [];
    }
    return [{ id, x, y, width: w, height: h, rotated: rotated === true }];
  });
};

/**
 * Whether the scene says its image holds pieces of its own art: it lists
 * them, whether or not each entry can be read. Such an image is never an
 * older pack's single photo, kept whole: taken for one, it left pack_artwork
 * no room for anything beside it.
 */
export const listsOwnPieces = (raw: unknown): boolean =>
  Array.isArray(raw) && raw.length > 0;
