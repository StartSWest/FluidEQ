/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IStudioChatVideoAsk,
  TStudioChatVideoAnswer,
} from 'common/studioChat';

/**
 * A video's frames, drawn in the window for the chat's video_frames (Ivan,
 * 2026-11-11: "videos and everything Higgsfield can do"): a scene plays no
 * video, so a video Higgsfield made becomes an animation — a few evenly
 * spaced frames, laid into a sheet by build_sheet like any other frames.
 *
 * Only a page decodes video. Each frame is the video sought to its moment
 * and drawn once the element says it is there (`seeked`), never after a
 * wait: a seek lands when the decoder has the frame, however long that
 * takes on the machine at hand.
 */

/**
 * The moments to draw: `count` of them spread evenly over [from, to], each
 * in the middle of its share, so neither the first nor the last frame is the
 * fade a clip so often starts or ends on, and a loop's last frame does not
 * repeat its first.
 */
export const frameMoments = (
  count: number,
  duration: number,
  from = 0,
  to = duration,
): number[] => {
  const start = Math.max(0, Math.min(from, duration));
  const end = Math.max(start, Math.min(to, duration));
  const share = (end - start) / count;
  return Array.from({ length: count }, (_, index) =>
    Number((start + share * (index + 0.5)).toFixed(4)),
  );
};

/** The size a frame is drawn at: the video's own, its longest side `edge`. */
export const frameSize = (
  width: number,
  height: number,
  edge: number,
): { width: number; height: number } => {
  const scale = Math.min(1, edge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

/** Resolves when `event` fires on the element, rejects on an error. */
const next = (video: HTMLVideoElement, event: string) =>
  new Promise<void>((resolve, reject) => {
    const done = () => {
      video.removeEventListener('error', failed);
      resolve();
    };
    const failed = () => {
      video.removeEventListener(event, done);
      reject(new Error('video unreadable'));
    };
    video.addEventListener(event, done, { once: true });
    video.addEventListener('error', failed, { once: true });
  });

const pngOf = async (canvas: OffscreenCanvas) =>
  new Uint8Array(
    await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer(),
  );

export default async function videoFrames(
  ask: Omit<IStudioChatVideoAsk, 'id'>,
): Promise<TStudioChatVideoAnswer> {
  const url = URL.createObjectURL(
    new Blob([ask.video as BlobPart], { type: ask.type }),
  );
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  try {
    const loaded = next(video, 'loadeddata');
    video.src = url;
    try {
      await loaded;
    } catch {
      return { ok: false, reason: 'unreadable' };
    }
    const { videoWidth, videoHeight, duration } = video;
    if (!videoWidth || !videoHeight || !Number.isFinite(duration)) {
      return { ok: false, reason: 'unreadable' };
    }
    const size = frameSize(videoWidth, videoHeight, ask.edge);
    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext('2d');
    if (!context) {
      return { ok: false, reason: 'failed' };
    }
    const frames: Uint8Array[] = [];
    // eslint-disable-next-line no-restricted-syntax -- one seek at a time: each frame waits for its own
    for (const moment of frameMoments(ask.count, duration, ask.from, ask.to)) {
      const sought = next(video, 'seeked');
      video.currentTime = moment;
      // eslint-disable-next-line no-await-in-loop -- the element seeks one moment at a time
      await sought;
      context.clearRect(0, 0, size.width, size.height);
      context.drawImage(video, 0, 0, size.width, size.height);
      // eslint-disable-next-line no-await-in-loop -- in order, one canvas
      frames.push(await pngOf(canvas));
    }
    return { ok: true, frames, ...size, duration };
  } catch {
    return { ok: false, reason: 'failed' };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
