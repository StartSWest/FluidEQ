/**
 * A publication's clip from a project that ran ahead of the gallery.
 *
 * Since b2d35067b a publication goes out one above the gallery's version,
 * which is below the project's own number when the maker's AI raised it for
 * every change (v23 on the bench, v11 out). The clip is recorded from the
 * project, so its `sourceVersion` is 23 and its `version` 11 - and the read
 * of the upload refused every such clip as "preview-invalid" before the
 * scene was even read (Ivan, 2026-11-09: "todavia no puedo publicar la
 * escena").
 */
import { randomUUID } from 'crypto';
import {
  previewMatchesSource,
  previewPackSha256,
  readPreviewUpload,
} from '../../../main/plus/scenePreviewApi';
import type { IScenePack } from '../../../common/scenePacks';

const pack = {
  schema: 1,
  id: 'ember',
  version: 23,
  contract: 6,
  names: { en: 'Ember' },
  fallbackStyle: 'dots',
  swatch: ['#112233', '#445566'],
  source: 'void main(){}',
  params: [],
} as unknown as IScenePack;

const upload = (sourceVersion: number, version: number) => ({
  bytes: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]),
  operationId: randomUUID(),
  sceneId: pack.id,
  sourceVersion,
  version,
  packSha256: previewPackSha256({ ...pack, version }),
});

describe('a clip from a project ahead of the gallery', () => {
  it('is read, with its published number below the project’s own', () => {
    const read = readPreviewUpload(upload(23, 11));
    expect(read).toMatchObject({ sourceVersion: 23, version: 11 });
  });

  it('matches the pack it was recorded from, at the number it goes out under', () => {
    const read = readPreviewUpload(upload(23, 11));
    expect(read && previewMatchesSource(read, pack, 11)).toBe(true);
  });

  // The controls: what still guards the clip.
  it('is refused under a version that is no version at all', () => {
    expect(readPreviewUpload(upload(23, 0))).toBeUndefined();
  });

  it('does not match a different published number, or another pack', () => {
    const read = readPreviewUpload(upload(23, 11));
    if (!read) {
      throw new Error('the clip should have been read');
    }
    expect(previewMatchesSource(read, pack, 12)).toBe(false);
    expect(previewMatchesSource(read, { ...pack, version: 24 }, 11)).toBe(
      false,
    );
    expect(
      previewMatchesSource(read, { ...pack, source: 'void main(){ }' }, 11),
    ).toBe(false);
  });
});
