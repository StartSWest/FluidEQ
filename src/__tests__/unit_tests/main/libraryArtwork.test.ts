import fs from 'fs';
import os from 'os';
import path from 'path';
import expectReportedError from '../../utils/reportedError';

const resize = jest.fn(() => ({ toJPEG: () => Buffer.from('jpeg-bytes') }));
/** A cached cover read back from disk, 320 wide and 280 tall. */
const sizedResize = jest.fn((size: { width: number }) => ({
  toJPEG: () => Buffer.from(`jpeg-${size.width}`),
}));
const crop = jest.fn(() => ({ resize: sizedResize }));
let mockCoverIsEmpty = false;
jest.mock('electron', () => ({
  nativeImage: {
    createFromBuffer: () => ({ isEmpty: () => false, resize }),
    createFromPath: () => ({
      isEmpty: () => mockCoverIsEmpty,
      getSize: () => ({ width: 320, height: 280 }),
      crop,
    }),
  },
}));

// eslint-disable-next-line import/first -- the mock must be installed first
import {
  artworkId,
  artworkPath,
  ensureSizedArtwork,
  sizedArtworkPath,
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
    const id = await expectReportedError('Could not cache artwork', () =>
      storeArtwork(dir, bytes),
    );
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

describe('a cover’s smaller pictures', () => {
  beforeEach(() => {
    crop.mockClear();
    sizedResize.mockClear();
    mockCoverIsEmpty = false;
  });

  it('makes each once, from the middle square, at its size’s edge', async () => {
    const dir = tempDir();
    const small = await ensureSizedArtwork(dir, 'a1b2c3', 'small');
    expect(small).toBe(path.join(dir, 'library-art', 'small', 'a1b2c3.jpg'));
    expect(small).toBe(sizedArtworkPath(dir, 'a1b2c3', 'small'));
    // 320 x 280: the middle 280 square.
    expect(crop).toHaveBeenCalledWith({ x: 20, y: 0, width: 280, height: 280 });
    expect(sizedResize).toHaveBeenCalledWith({
      width: 96,
      height: 96,
      quality: 'good',
    });
    expect(fs.readFileSync(small as string, 'utf8')).toBe('jpeg-96');
    const medium = await ensureSizedArtwork(dir, 'a1b2c3', 'medium');
    expect(fs.readFileSync(medium as string, 'utf8')).toBe('jpeg-224');
    // Asked again, the file is there and nothing is made.
    crop.mockClear();
    expect(await ensureSizedArtwork(dir, 'a1b2c3', 'small')).toBe(small);
    expect(crop).not.toHaveBeenCalled();
  });

  it('makes one file when two rows ask at once', async () => {
    const dir = tempDir();
    const [first, second] = await Promise.all([
      ensureSizedArtwork(dir, 'd4e5f6', 'small'),
      ensureSizedArtwork(dir, 'd4e5f6', 'small'),
    ]);
    expect(first).toBe(second);
    expect(crop).toHaveBeenCalledTimes(1);
    // No temporary file left beside it.
    expect(fs.readdirSync(path.dirname(first as string))).toEqual([
      'd4e5f6.jpg',
    ]);
  });

  it('writes through a temporary file, never straight to the picture', async () => {
    // A request finding the file is told it is whole; a kill mid-write must
    // land on a name nothing asks for. The end state alone cannot show it: a
    // direct write that finishes looks the same as a rename into place.
    const dir = tempDir();
    const writeFile = jest.spyOn(fs.promises, 'writeFile');
    const rename = jest.spyOn(fs.promises, 'rename');
    const target = await ensureSizedArtwork(dir, 'c0ffee', 'medium');
    expect(target).toBeDefined();
    expect(writeFile).toHaveBeenCalledTimes(1);
    const [written] = writeFile.mock.calls[0] ?? [];
    expect(written).not.toBe(target);
    expect(String(written).startsWith(`${target}.`)).toBe(true);
    expect(rename).toHaveBeenCalledWith(written, target);
    writeFile.mockRestore();
    rename.mockRestore();
  });

  it('answers nothing for a cover it cannot read, or an id it did not mint', async () => {
    const dir = tempDir();
    mockCoverIsEmpty = true;
    expect(await ensureSizedArtwork(dir, 'abcdef', 'small')).toBeUndefined();
    expect(fs.existsSync(path.join(dir, 'library-art', 'small'))).toBe(false);
    expect(
      await ensureSizedArtwork(dir, '../../secrets', 'small'),
    ).toBeUndefined();
    expect(sizedArtworkPath(dir, '../../secrets', 'medium')).toBeUndefined();
  });
});
