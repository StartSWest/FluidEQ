import { readScenePreviewMp4 } from './scenePreviewMp4';

/** Published clips use native VP8/WebM throughout Electron's three platforms.
 * The bounded parser is also vendored to the private upload service. It reads
 * actual track/frame headers and timestamps, never client-declared metadata. */
export const SCENE_PREVIEW_MIME = 'video/webm';
export const SCENE_PREVIEW_CODEC = 'video/webm;codecs=vp8';
export const SCENE_PREVIEW_MP4_CODEC = 'video/mp4;codecs=avc1.42001F';
// Every published scene keeps one clip, so storage grows with the catalogue
// and each view downloads the whole file. Recorded through Chromium's own
// MediaRecorder from real scenes (2026-10-31, a full-screen city and the
// campfire): 960x540 at 1.8 Mbit/s came to 1.5 MB, 854x480 at 700 kbit/s to
// 0.6 MB with the trees and stones still as sharp, where 640x360 at the same
// size was visibly softer. The cap leaves an encoder 2.5x its target on the
// busiest scene and refuses anything larger from any client.
export const MAX_PREVIEW_BYTES = 1.5 * 1024 * 1024;
export const PREVIEW_MAX_WIDTH = 854;
export const PREVIEW_MAX_HEIGHT = 480;
export const PREVIEW_DURATION_MS = 10000;

export interface IScenePreviewMetadata {
  mimeType: 'video/webm' | 'video/mp4';
  durationMs: number;
  width: number;
  height: number;
  frames: number;
}

export interface IScenePreviewUpload {
  bytes: Uint8Array;
  operationId: string;
  sceneId: string;
  sourceVersion: number;
  version: number;
  packSha256: string;
}

export type TScenePublishPhase = 'preparing' | 'uploading' | 'publishing';
export interface IScenePublishProgress {
  id: string;
  phase: TScenePublishPhase;
}

export { canonicalPreviewPayload } from './scenePreviewPayload';

interface IElement {
  id: number;
  body: number;
  end: number;
  unknown: boolean;
}
interface IVint {
  value: number;
  width: number;
  unknown: boolean;
}
const invalid = (): never => {
  throw new Error('Invalid scene preview media');
};

const vint = (bytes: Uint8Array, at: number, id = false): IVint => {
  const first = bytes[at];
  let width = 1;
  while (width <= 8 && first < 2 ** (8 - width)) {
    width += 1;
  }
  if (!first || width > (id ? 4 : 8) || at + width > bytes.length) {
    return invalid();
  }
  let value = id ? first : first - 2 ** (8 - width);
  let unknown = !id && value === 2 ** (8 - width) - 1;
  for (let offset = 1; offset < width; offset += 1) {
    value = value * 256 + bytes[at + offset];
    unknown = unknown && bytes[at + offset] === 255;
  }
  if (!unknown && !Number.isSafeInteger(value)) {
    return invalid();
  }
  return { value, width, unknown };
};

const LEVEL_ONE = new Set([
  0x114d9b74, 0x1549a966, 0x1654ae6b, 0x1f43b675, 0x1c53bb6b, 0x1254c367,
  0x1043a770, 0x1941a469,
]);
const children = (
  bytes: Uint8Array,
  from: number,
  to: number,
  cluster = false,
): IElement[] => {
  const result: IElement[] = [];
  for (let at = from; at < to;) {
    if (result.length > 20000) {
      return invalid();
    }
    const id = vint(bytes, at, true);
    if (cluster && LEVEL_ONE.has(id.value)) {
      break;
    }
    const size = vint(bytes, at + id.width);
    const body = at + id.width + size.width;
    let end = size.unknown ? to : body + size.value;
    if (body > to || end > to || end <= at) {
      return invalid();
    }
    if (size.unknown && id.value === 0x1f43b675) {
      const fields = children(bytes, body, to, true);
      end = fields.length ? fields[fields.length - 1].end : body;
    } else if (size.unknown && id.value !== 0x18538067) {
      return invalid();
    }
    result.push({ id: id.value, body, end, unknown: size.unknown });
    at = end;
  }
  return result;
};

const uint = (
  bytes: Uint8Array,
  element: IElement | undefined,
  fallback?: number,
): number => {
  if (!element) {
    if (fallback !== undefined) {
      return fallback;
    }
    return invalid();
  }
  if (element.end - element.body > 6 || element.end === element.body) {
    return invalid();
  }
  let value = 0;
  for (let at = element.body; at < element.end; at += 1) {
    value = value * 256 + bytes[at];
  }
  return value;
};
const text = (bytes: Uint8Array, element: IElement | undefined) =>
  element
    ? new TextDecoder('utf-8', { fatal: true }).decode(
        bytes.subarray(element.body, element.end),
      )
    : invalid();
const float = (bytes: Uint8Array, element: IElement | undefined): number => {
  if (!element) {
    return invalid();
  }
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset + element.body,
    element.end - element.body,
  );
  if (view.byteLength === 4) {
    return view.getFloat32(0);
  }
  if (view.byteLength === 8) {
    return view.getFloat64(0);
  }
  return invalid();
};

export const readScenePreviewMedia = (
  bytes: Uint8Array,
  mimeType: string,
): IScenePreviewMetadata => {
  if (bytes.length < 32 || bytes.length > MAX_PREVIEW_BYTES) {
    return invalid();
  }
  if (mimeType.split(';')[0].trim() === 'video/mp4') {
    const mp4 = readScenePreviewMp4(bytes);
    if (mp4.width > PREVIEW_MAX_WIDTH || mp4.height > PREVIEW_MAX_HEIGHT) {
      return invalid();
    }
    return mp4;
  }
  if (
    mimeType.split(';')[0].trim() !== SCENE_PREVIEW_MIME ||
    bytes.length < 32 ||
    bytes.length > MAX_PREVIEW_BYTES
  ) {
    return invalid();
  }
  const top = children(bytes, 0, bytes.length);
  if (
    top.length !== 2 ||
    top[0].id !== 0x1a45dfa3 ||
    top[1].id !== 0x18538067
  ) {
    return invalid();
  }
  const header = children(bytes, top[0].body, top[0].end);
  if (
    text(
      bytes,
      header.find((item) => item.id === 0x4282),
    ) !== 'webm'
  ) {
    return invalid();
  }
  const entries = children(bytes, top[1].body, top[1].end);
  const info = entries.filter((item) => item.id === 0x1549a966);
  const tracks = entries.filter((item) => item.id === 0x1654ae6b);
  if (info.length !== 1 || tracks.length !== 1) {
    return invalid();
  }
  const fields = children(bytes, info[0].body, info[0].end);
  const scale =
    uint(
      bytes,
      fields.find((item) => item.id === 0x2ad7b1),
      1000000,
    ) / 1000000;
  const durationMs =
    float(
      bytes,
      fields.find((item) => item.id === 0x4489),
    ) * scale;
  if (
    !Number.isFinite(durationMs) ||
    durationMs < 9750 ||
    durationMs > 10500 ||
    scale <= 0 ||
    scale > 1000
  ) {
    return invalid();
  }
  const streams = children(bytes, tracks[0].body, tracks[0].end).filter(
    (item) => item.id === 0xae,
  );
  // No audio, subtitles, auxiliary tracks or external codec/link references.
  if (streams.length !== 1) {
    return invalid();
  }
  const stream = children(bytes, streams[0].body, streams[0].end);
  if (
    uint(
      bytes,
      stream.find((item) => item.id === 0x83),
    ) !== 1 ||
    text(
      bytes,
      stream.find((item) => item.id === 0x86),
    ) !== 'V_VP8'
  ) {
    return invalid();
  }
  if (
    stream.some((item) =>
      [0x6d80, 0x63a2, 0x6fab, 0x3e83bb, 0x3e84bb].includes(item.id),
    )
  ) {
    return invalid();
  }
  const track = uint(
    bytes,
    stream.find((item) => item.id === 0xd7),
  );
  const video = stream.find((item) => item.id === 0xe0);
  if (!video || !track) {
    return invalid();
  }
  const dimensions = children(bytes, video.body, video.end);
  const width = uint(
    bytes,
    dimensions.find((item) => item.id === 0xb0),
  );
  const height = uint(
    bytes,
    dimensions.find((item) => item.id === 0xba),
  );
  if (
    width < 2 ||
    height < 2 ||
    width > PREVIEW_MAX_WIDTH ||
    height > PREVIEW_MAX_HEIGHT
  ) {
    return invalid();
  }
  let frames = 0;
  let first: number | undefined;
  let last = 0;
  const block = (item: IElement, time: number) => {
    const number = vint(bytes, item.body);
    const flagsAt = item.body + number.width + 2;
    const dataAt = flagsAt + 1;
    if (
      number.value !== track ||
      flagsAt >= item.end ||
      bytes[flagsAt] % 8 >= 2 ||
      dataAt + 3 > item.end
    ) {
      return invalid();
    }
    const relative = new DataView(
      bytes.buffer,
      bytes.byteOffset + item.body + number.width,
      2,
    ).getInt16(0);
    const atMs = (time + relative) * scale;
    if (atMs < 0 || atMs > 10500 || (frames > 0 && atMs < last)) {
      return invalid();
    }
    const key = bytes[dataAt] % 2 === 0;
    if (!frames && !key) {
      return invalid();
    }
    if (key) {
      if (
        dataAt + 10 > item.end ||
        bytes[dataAt + 3] !== 0x9d ||
        bytes[dataAt + 4] !== 0x01 ||
        bytes[dataAt + 5] !== 0x2a
      ) {
        return invalid();
      }
      const codedWidth = (bytes[dataAt + 6] + bytes[dataAt + 7] * 256) % 16384;
      const codedHeight = (bytes[dataAt + 8] + bytes[dataAt + 9] * 256) % 16384;
      if (codedWidth !== width || codedHeight !== height) {
        return invalid();
      }
    }
    first ??= atMs;
    last = atMs;
    frames += 1;
    if (frames > 400) {
      return invalid();
    }
    return undefined;
  };
  const clusters = entries.filter((item) => item.id === 0x1f43b675);
  for (
    let clusterIndex = 0;
    clusterIndex < clusters.length;
    clusterIndex += 1
  ) {
    const cluster = clusters[clusterIndex];
    const items = children(bytes, cluster.body, cluster.end);
    const time = uint(
      bytes,
      items.find((item) => item.id === 0xe7),
      0,
    );
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];
      if (item.id === 0xa3) {
        block(item, time);
      }
      if (item.id === 0xa0) {
        const groups = children(bytes, item.body, item.end).filter(
          (group) => group.id === 0xa1,
        );
        if (groups.length !== 1) {
          return invalid();
        }
        block(groups[0], time);
      }
    }
  }
  if (
    frames < 20 ||
    first === undefined ||
    last - first < 9500 ||
    Math.abs(last - durationMs) > 500
  ) {
    return invalid();
  }
  return { mimeType: SCENE_PREVIEW_MIME, durationMs, width, height, frames };
};
