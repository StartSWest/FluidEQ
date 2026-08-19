import fs from 'fs';
import os from 'os';
import path from 'path';

const resize = jest.fn(() => ({ toJPEG: () => Buffer.from('jpeg-bytes') }));
jest.mock('electron', () => ({
  nativeImage: { createFromBuffer: () => ({ isEmpty: () => false, resize }) },
}));

// eslint-disable-next-line import/first -- the mock must be installed first
import {
  artworkId,
  artworkPath,
  storeArtwork,
} from '../../../main/library/libraryArtwork';

const tempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-art-'));

describe('caching a cover', () => {
  it('gives identical images the same id', () => {
    // Two hundred tracks from one album carry the same picture. Hashing the
    // bytes is what makes that one file on disk instead of two hundred.
    expect(artworkId(new Uint8Array([1, 2, 3]))).toBe(
      artworkId(new Uint8Array([1, 2, 3])),
    );
    expect(artworkId(new Uint8Array([1, 2, 3]))).not.toBe(
      artworkId(new Uint8Array([3, 2, 1])),
    );
  });

  it('writes the resized image once and returns its id', async () => {
    const dir = tempDir();
    const id = await storeArtwork(dir, new Uint8Array([1, 2, 3]));
    expect(id).toBeDefined();
    expect(
      fs.readFileSync(path.join(dir, 'library-art', `${id}.jpg`), 'utf8'),
    ).toBe('jpeg-bytes');
  });

  it('does not resize an image it has already cached', async () => {
    const dir = tempDir();
    await storeArtwork(dir, new Uint8Array([9]));
    resize.mockClear();
    await storeArtwork(dir, new Uint8Array([9]));
    expect(resize).not.toHaveBeenCalled();
  });

  it('refuses an id that is not one it wrote', () => {
    // The path the media protocol will hand it comes from a URL. It resolves
    // ids, and an id is hex — never a traversal.
    const dir = tempDir();
    expect(artworkPath(dir, '../../secrets')).toBeUndefined();
    expect(artworkPath(dir, 'a1b2c3')).toBe(
      path.join(dir, 'library-art', 'a1b2c3.jpg'),
    );
  });

  it('leaves no file at the final path when encoding fails partway', async () => {
    // A kill or a full disk mid-write must not leave a truncated JPEG sitting
    // at the exact path every future call treats as "already cached" — that
    // album's cover would stay broken forever, with nothing to repair it.
    const dir = tempDir();
    const bytes = new Uint8Array([4, 4, 4]);
    resize.mockImplementationOnce(() => ({
      toJPEG: () => {
        throw new Error('disk full');
      },
    }));
    const id = await storeArtwork(dir, bytes);
    expect(id).toBeUndefined();
    const target = artworkPath(dir, artworkId(bytes));
    if (target === undefined) {
      throw new Error('expected artworkPath to resolve for a valid hex id');
    }
    expect(fs.existsSync(target)).toBe(false);
  });
});
