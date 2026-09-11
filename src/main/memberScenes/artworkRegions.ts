/** Optional authoring metadata; never code and never included in a signed pack. */
export interface IArtworkRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
}

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
    raw.length > 64
  ) {
    return [];
  }
  const regions: IArtworkRegion[] = [];
  const ids = new Set<string>();
  raw.forEach((value) => {
    if (
      !value ||
      typeof value !== 'object' ||
      typeof value.id !== 'string' ||
      !/^[a-z][a-z0-9_-]{0,31}$/.test(value.id) ||
      ids.has(value.id) ||
      ![value.x, value.y, value.width, value.height].every(Number.isInteger) ||
      value.x < 0 ||
      value.y < 0 ||
      value.width < 1 ||
      value.height < 1 ||
      value.x + value.width > width ||
      value.y + value.height > height
    ) {
      return;
    }
    ids.add(value.id);
    regions.push({
      id: value.id,
      x: value.x,
      y: value.y,
      width: value.width,
      height: value.height,
      rotated: value.rotated === true,
    });
  });
  return regions.length === raw.length ? regions : [];
};
