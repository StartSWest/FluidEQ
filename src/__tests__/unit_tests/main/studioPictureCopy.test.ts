/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { registerStudioPictureCopy } from '../../../main/ipc/studioPictureCopy';
import { readArtworkRegions } from '../../../main/memberScenes/artworkRegions';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(name, fn),
    removeHandler: (name: string) => handlers.delete(name),
  },
  dialog: {},
}));
const region = { id: 'water', x: 0, y: 1, width: 4, height: 3, rotated: false };
it('rebuilds only bounded regions and rejects an invalid or ambiguous layout', () => {
  expect(readArtworkRegions([{ ...region, code: 'ignored' }], 8, 8)).toEqual([
    region,
  ]);
  expect(
    readArtworkRegions([{ ...region, rotated: true }], 8, 8)[0].rotated,
  ).toBe(true);
  expect(readArtworkRegions([region, region], 8, 8)).toEqual([]);
  expect(readArtworkRegions([{ ...region, x: -1 }], 8, 8)).toEqual([]);
  expect(readArtworkRegions([{ ...region, width: 9 }], 8, 8)).toEqual([]);
  expect(readArtworkRegions([{ ...region, height: 1.5 }], 8, 8)).toEqual([]);
  expect(readArtworkRegions([{ ...region, id: '../../escape' }], 8, 8)).toEqual(
    [],
  );
  expect(readArtworkRegions(Array(65).fill(region), 8, 8)).toEqual([]);
});

describe('saving a copy of a Studio image', () => {
  let root: string;
  let folder: string | undefined;
  let paid: boolean;
  let stop: () => void;
  const choose = jest.fn();
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
  const save = (bytes: unknown = png, name: unknown = 'water') =>
    handlers.get('studio-picture-copy')!({}, bytes, name);
  beforeEach(async () => {
    root = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'studio-picture-copy-'),
    );
    folder = root;
    paid = true;
    choose.mockReset().mockResolvedValue({
      canceled: false,
      filePath: path.join(root, 'copy.png'),
    });
    stop = registerStudioPictureCopy({
      getMainWindow: () => null,
      entitled: () => paid,
      activeFolder: () => folder,
      dialogImpl: { showSaveDialog: choose },
    });
  });
  afterEach(async () => {
    stop();
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  it('writes the original bytes only to the path chosen by the user', async () => {
    expect(await save()).toBe('saved');
    expect(await fs.promises.readFile(path.join(root, 'copy.png'))).toEqual(
      Buffer.from(png),
    );
    expect(choose).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: path.join(root, 'water-copy.png'),
      }),
    );
  });
  it('keeps a full WebP unchanged and sanitizes the proposed name', async () => {
    const webp = Buffer.from('RIFF0000WEBPbytes');
    expect(await save(webp, '../../bad')).toBe('saved');
    expect(await fs.promises.readFile(path.join(root, 'copy.png'))).toEqual(
      webp,
    );
    expect(choose).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: path.join(root, 'scene-image-copy.webp'),
      }),
    );
  });
  it('writes nothing when cancelled', async () => {
    choose.mockResolvedValue({ canceled: true });
    expect(await save()).toBe('cancelled');
    expect(await fs.promises.readdir(root)).toEqual([]);
  });
  it('rejects non-images, missing projects and accounts without Plus before opening a dialog', async () => {
    expect(await save(new Uint8Array([1, 2]))).toBe('failed');
    expect(await save('not bytes')).toBe('failed');
    paid = false;
    expect(await save()).toBe('failed');
    paid = true;
    folder = undefined;
    expect(await save()).toBe('failed');
    expect(choose).not.toHaveBeenCalled();
  });
  it.each(['project', 'subscription'])(
    'does not save after the %s changes during the dialog',
    async (change) => {
      choose.mockImplementation(async () => {
        if (change === 'project') {
          folder = undefined;
        } else {
          paid = false;
        }
        return { canceled: false, filePath: path.join(root, 'copy.png') };
      });
      expect(await save()).toBe('failed');
      expect(await fs.promises.readdir(root)).toEqual([]);
    },
  );
});
