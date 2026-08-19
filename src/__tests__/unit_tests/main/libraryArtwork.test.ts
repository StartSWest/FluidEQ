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

  it('returns undefined and leaves no file when the encoder throws', async () => {
    // Error-path coverage only: the encoder throws before any write is
    // attempted, so this cannot tell a temp-then-rename write apart from a
    // direct one that never got the chance to run. That distinction is
    // 'writes through a temporary file, never straight to the cached path',
    // below.
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

  it('writes through a temporary file, never straight to the cached path', async () => {
    // This is the actual atomicity guarantee: a kill or a full disk mid-write
    // must land its damage on a `.tmp` file nothing looks at, never on the
    // path every future call trusts as "already cached". Asserting the
    // mechanism — what path writeFileSync received, what rename moved where
    // — is what catches a regression to a direct write; asserting only the
    // end state does not, because a direct write that fully succeeds looks
    // identical to a safe one that renamed into place.
    const dir = tempDir();
    const bytes = new Uint8Array([5, 5, 5]);
    const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');
    const renameSyncSpy = jest.spyOn(fs, 'renameSync');
    const id = await storeArtwork(dir, bytes);
    expect(id).toBeDefined();
    const target = artworkPath(dir, artworkId(bytes));
    if (target === undefined) {
      throw new Error('expected artworkPath to resolve for a valid hex id');
    }
    const temporary = `${target}.tmp`;
    expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
    expect(writeFileSyncSpy.mock.calls[0]?.[0]).toBe(temporary);
    expect(writeFileSyncSpy.mock.calls[0]?.[0]).not.toBe(target);
    expect(renameSyncSpy).toHaveBeenCalledWith(temporary, target);
    writeFileSyncSpy.mockRestore();
    renameSyncSpy.mockRestore();
  });
});
