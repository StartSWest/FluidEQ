/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import createLinuxMediaArtwork from '../../../main/linux/linuxMediaArtwork';

const picture = Buffer.alloc(80, 1);
picture.set([0x89, 0x50, 0x4e, 0x47]);
const record = (title: string, artUrl: string) =>
  JSON.stringify({
    app: 'org.mpris.MediaPlayer2.test',
    title,
    artist: 'Artist',
    artUrl,
  });

it('adapts file artwork once and keeps later readings on the same cover', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'fluideq-cover-'));
  try {
    const file = path.join(folder, 'cover.png');
    await writeFile(file, picture);
    const emit = jest.fn();
    const adapter = createLinuxMediaArtwork(emit);
    const line = record('Track', pathToFileURL(file).href);
    await adapter.read(line);
    expect(emit).toHaveBeenCalledTimes(3);
    const { cover } = JSON.parse(emit.mock.calls[1][0]);
    expect(cover.type).toBe('image/png');
    expect(Buffer.from(cover.data, 'base64')).toEqual(picture);
    expect(JSON.parse(emit.mock.calls[2][0]).coverId).toBe(cover.id);
    await adapter.read(line);
    expect(emit).toHaveBeenCalledTimes(4);
    expect(JSON.parse(emit.mock.calls[3][0]).coverId).toBe(cover.id);
    adapter.dispose();
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

it('does not attach a delayed cover after the player has changed songs', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'fluideq-cover-'));
  try {
    const file = path.join(folder, 'cover.png');
    await writeFile(file, picture);
    const emit = jest.fn();
    const adapter = createLinuxMediaArtwork(emit);
    const pending = adapter.read(record('Old track', pathToFileURL(file).href));
    await adapter.read(record('New track', ''));
    await pending;
    expect(emit).toHaveBeenCalledTimes(2);
    expect(JSON.parse(emit.mock.calls[1][0])).toMatchObject({
      title: 'New track',
      coverId: '',
    });
    adapter.dispose();
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

it('rejects unknown bytes and ignores late requests after disposal', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'fluideq-cover-'));
  try {
    const file = path.join(folder, 'not-an-image');
    await writeFile(file, Buffer.alloc(80));
    const emit = jest.fn();
    const adapter = createLinuxMediaArtwork(emit);
    await adapter.read(record('Track', pathToFileURL(file).href));
    expect(emit).toHaveBeenCalledTimes(1);
    expect(JSON.parse(emit.mock.calls[0][0]).coverId).toBe('');
    adapter.dispose();
    await adapter.read(record('Other track', pathToFileURL(file).href));
    expect(emit).toHaveBeenCalledTimes(1);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
