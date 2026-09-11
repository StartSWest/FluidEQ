/**
 * Gallery pictures kept in memory once fetched, as the data URLs the page
 * shows, bounded by the bytes they take rather than by how many: the oldest
 * go first, and one seen again moves to the back of the queue. Scrolling back
 * up the gallery then asks the network for nothing.
 */

export interface IPictureCache {
  get(key: string): string | undefined;
  put(key: string, dataUrl: string): void;
  clear(): void;
}

export const createPictureCache = (maxBytes: number): IPictureCache => {
  const pictures = new Map<string, string>();
  let bytes = 0;

  return {
    get: (key) => {
      const cached = pictures.get(key);
      if (cached !== undefined) {
        pictures.delete(key);
        pictures.set(key, cached);
      }
      return cached;
    },
    put: (key, dataUrl) => {
      const previous = pictures.get(key);
      if (previous !== undefined) {
        bytes -= previous.length;
        pictures.delete(key);
      }
      pictures.set(key, dataUrl);
      bytes += dataUrl.length;
      // A Map iterates in the order entries went in, and `some` stops at the
      // first one the budget no longer needs gone.
      Array.from(pictures).some(([oldest, value]) => {
        if (bytes <= maxBytes) {
          return true;
        }
        pictures.delete(oldest);
        bytes -= value.length;
        return false;
      });
    },
    clear: () => {
      pictures.clear();
      bytes = 0;
    },
  };
};
