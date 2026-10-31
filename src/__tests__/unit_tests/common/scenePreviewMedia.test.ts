import { readFileSync } from 'fs';
import path from 'path';
import {
  MAX_PREVIEW_BYTES,
  PREVIEW_MAX_HEIGHT,
  PREVIEW_MAX_WIDTH,
  readScenePreviewMedia,
} from 'common/scenePreviewMedia';

// Ten seconds of one colour at 10 fps, made with ffmpeg (libvpx, and libx264
// baseline) at the box itself and one step past it.
const clip = (name: string) =>
  new Uint8Array(readFileSync(path.join(__dirname, '../../utils', name)));

it('keeps a published clip to 854x480 and 1.5 MB', () => {
  expect([PREVIEW_MAX_WIDTH, PREVIEW_MAX_HEIGHT]).toEqual([854, 480]);
  expect(MAX_PREVIEW_BYTES).toBe(1572864);
});

it('accepts a clip exactly the size of the box, in both formats', () => {
  expect(
    readScenePreviewMedia(clip('preview-854x480.webm'), 'video/webm'),
  ).toMatchObject({ mimeType: 'video/webm', width: 854, height: 480 });
  expect(
    readScenePreviewMedia(clip('preview-854x480.mp4'), 'video/mp4'),
  ).toMatchObject({ mimeType: 'video/mp4', width: 854, height: 480 });
});

it('refuses a clip one step wider or taller than the box, in both formats', () => {
  expect(() =>
    readScenePreviewMedia(clip('preview-856x480.webm'), 'video/webm'),
  ).toThrow('Invalid scene preview media');
  expect(() =>
    readScenePreviewMedia(clip('preview-854x482.mp4'), 'video/mp4'),
  ).toThrow('Invalid scene preview media');
});

it('refuses a file over the cap before reading it', () => {
  const large = new Uint8Array(MAX_PREVIEW_BYTES + 1);
  large.set(clip('preview-854x480.webm'));
  expect(() => readScenePreviewMedia(large, 'video/webm')).toThrow(
    'Invalid scene preview media',
  );
});
