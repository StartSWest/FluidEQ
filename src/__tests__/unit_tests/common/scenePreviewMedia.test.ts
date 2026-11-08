import { readFileSync } from 'fs';
import path from 'path';
import {
  MAX_PREVIEW_BYTES,
  PREVIEW_MAX_HEIGHT,
  PREVIEW_MAX_WIDTH,
  readScenePreviewMedia,
} from 'common/scenePreviewMedia';

// Ten seconds of one colour at 10 fps, made with ffmpeg at the box itself
// and one step past it, in each format: 1280x720 VP9 and H.264 is what the
// Studio records from 2.3.1, 854x480 VP8 and H.264 what 2.3.0 uploads. The
// same files are the server's fixtures, so both readers answer the same.
const clip = (name: string) =>
  new Uint8Array(readFileSync(path.join(__dirname, '../../utils', name)));

const reading = (name: string, type: 'video/webm' | 'video/mp4') => () =>
  readScenePreviewMedia(clip(name), type);
const REFUSED = 'Invalid scene preview media';

it('keeps a published clip to 1280x720 and 1.5 MB', () => {
  expect([PREVIEW_MAX_WIDTH, PREVIEW_MAX_HEIGHT]).toEqual([1280, 720]);
  expect(MAX_PREVIEW_BYTES).toBe(1572864);
});

it('accepts a clip exactly the size of the box, VP9 and H.264', () => {
  expect(
    readScenePreviewMedia(clip('preview-1280x720.webm'), 'video/webm'),
  ).toMatchObject({ mimeType: 'video/webm', width: 1280, height: 720 });
  expect(
    readScenePreviewMedia(clip('preview-1280x720.mp4'), 'video/mp4'),
  ).toMatchObject({ mimeType: 'video/mp4', width: 1280, height: 720 });
});

it('refuses a clip one step wider or taller than the box, in both formats', () => {
  expect(reading('preview-1282x720.webm', 'video/webm')).toThrow(REFUSED);
  expect(reading('preview-1280x722.mp4', 'video/mp4')).toThrow(REFUSED);
});

it('still takes the clips 2.3.0 uploads: 854x480 VP8 and H.264', () => {
  expect(
    readScenePreviewMedia(clip('preview-854x480.webm'), 'video/webm'),
  ).toMatchObject({ mimeType: 'video/webm', width: 854, height: 480 });
  expect(
    readScenePreviewMedia(clip('preview-854x480.mp4'), 'video/mp4'),
  ).toMatchObject({ mimeType: 'video/mp4', width: 854, height: 480 });
});

// The VP9 reader takes the size from the key frame itself: a track naming
// 1280 over frames coded at 1278 is refused, as is profile 1 (4:4:4), which
// Chromium's encoders never write. The accepted 1280x720 clip above is the
// control: the same file but for those two bytes or that profile.
it('holds a VP9 clip to its own key frames and to profile 0', () => {
  expect(reading('preview-vp9-size-mismatch.webm', 'video/webm')).toThrow(
    REFUSED,
  );
  expect(reading('preview-vp9-profile1.webm', 'video/webm')).toThrow(REFUSED);
});

it('refuses a file over the cap before reading it', () => {
  const large = new Uint8Array(MAX_PREVIEW_BYTES + 1);
  large.set(clip('preview-1280x720.webm'));
  expect(() => readScenePreviewMedia(large, 'video/webm')).toThrow(REFUSED);
});
