/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import type {
  IStudioChatVideoAsk,
  TStudioChatVideoAnswer,
} from '../../common/studioChat';
import type { TAgentProject } from '../studioAgent/agentProject';
import type { IMcpTool, IMcpToolResult } from '../studioAgent/mcpProtocol';
import writeFileAtomically from '../atomicWrite';
import { ART_DIR, ART_NAME, artFolder, failure, text } from './artFolder';
import { MAX_SHEET_FRAMES } from './sheetShared';

/**
 * `video_frames`: a video in the project's `art/` folder turned into frames
 * an animation can be built from (Ivan, 2026-11-11: "videos and everything
 * Higgsfield can do"). A scene plays no video, so a clip Higgsfield made — a
 * bird's wing beat, a flag in the wind — becomes a few evenly spaced
 * pictures, `art/<name>-01.png` and on, which build_sheet then lays into the
 * animation the member sees and tunes in their Animations tab.
 *
 * The window draws the frames (only a page decodes video); this reads the
 * file, holds what it asks for to what a sheet can take, and writes what
 * comes back, never over a picture already there unless told to replace.
 */

const VIDEO_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};
/** A clip of a few seconds is a few megabytes; this is far past any. */
export const MAX_VIDEO_BYTES = 128 * 1024 * 1024;
const MIN_FRAMES = 2;
const DEFAULT_FRAMES = 12;
const MIN_EDGE = 64;
const MAX_EDGE = 512;
const DEFAULT_EDGE = 384;
/** A frame's PNG at 512 a side holds well under this. */
const MAX_FRAME_BYTES = 4 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export const VIDEO_FRAMES_SCHEMA = {
  type: 'object',
  properties: {
    video: {
      type: 'string',
      description:
        'The video in the project\'s art folder: "art/heron-flight.mp4". MP4, WebM or MOV.',
    },
    name: {
      type: 'string',
      description:
        "The frames' name: lowercase letters, digits and hyphens, starting with a letter. Written as art/<name>-01.png, art/<name>-02.png and on.",
    },
    frames: {
      type: 'integer',
      minimum: MIN_FRAMES,
      maximum: MAX_SHEET_FRAMES,
      description: `How many frames, evenly spaced over the part of the video asked for; ${DEFAULT_FRAMES} when left out. One wing beat or step reads well in 8 to 16.`,
    },
    size: {
      type: 'integer',
      minimum: MIN_EDGE,
      maximum: MAX_EDGE,
      description: `Each frame's longest side, in pixels; ${DEFAULT_EDGE} when left out. Smaller frames make a lighter scene.`,
    },
    from: {
      type: 'number',
      minimum: 0,
      description:
        'Where to start, in seconds from the start of the video: for one loop out of a longer clip.',
    },
    to: {
      type: 'number',
      minimum: 0,
      description: 'Where to stop, in seconds; the end when left out.',
    },
    replace: {
      type: 'boolean',
      description:
        'Write over frames of this name already in art/; without it, those are left alone and nothing is written.',
    },
  },
  required: ['video', 'name'],
  additionalProperties: false,
} as const;

export interface IVideoFramesDeps {
  project(): TAgentProject;
  signal(): AbortSignal;
  /** The window draws the frames: only a page decodes video. */
  framesInWindow(
    ask: Omit<IStudioChatVideoAsk, 'id'>,
  ): Promise<TStudioChatVideoAnswer | 'no-window'>;
}

/** The video's bytes and type, or why it cannot be read. */
const readVideo = (
  folder: string,
  asked: string,
): { bytes: Buffer; type: string } | string => {
  const match = /^art\/([a-z][a-z0-9-]{0,63})(\.[a-z0-9]{2,4})$/i.exec(asked);
  const type = match ? VIDEO_TYPES[match[2].toLowerCase()] : undefined;
  if (!match || !type) {
    return 'Name a video in the project\'s art folder, as "art/<name>.mp4" (or .webm, .mov). Save the video there first.';
  }
  const art = artFolder(folder);
  if (!art) {
    return 'The project has no art folder to read from.';
  }
  const file = path.join(art, `${match[1]}${match[2]}`);
  try {
    const stats = fs.lstatSync(file);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1) {
      return `${asked} is not a plain file in the art folder.`;
    }
    if (stats.size > MAX_VIDEO_BYTES) {
      return `${asked} is larger than FluidEQ reads (${MAX_VIDEO_BYTES / 1024 / 1024} MB): ask for a shorter clip.`;
    }
    return { bytes: fs.readFileSync(file), type };
  } catch {
    return `There is no ${asked} in the project.`;
  }
};

const isPng = (bytes: Uint8Array) =>
  bytes.byteLength <= MAX_FRAME_BYTES &&
  PNG_SIGNATURE.every((byte, at) => bytes[at] === byte);

const frameName = (name: string, index: number) =>
  `${name}-${String(index + 1).padStart(2, '0')}.png`;

const clampInt = (value: unknown, low: number, high: number, or: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(high, Math.max(low, Math.round(value)))
    : or;

const createVideoFramesTool = (deps: IVideoFramesDeps): IMcpTool => {
  const call = async (
    args: Record<string, unknown>,
  ): Promise<IMcpToolResult> => {
    const open = deps.project();
    if (!open.ok) {
      return failure("The chat's project is not open in the Studio now.");
    }
    const { video, name, from, to, replace } = args;
    if (typeof video !== 'string') {
      return failure('Say which video: "art/<name>.mp4".');
    }
    if (typeof name !== 'string' || !ART_NAME.test(name)) {
      return failure(
        'Name the frames with lowercase letters, digits and hyphens, starting with a letter, at most 40 characters.',
      );
    }
    const read = readVideo(open.folder, video);
    if (typeof read === 'string') {
      return failure(read);
    }
    const count = clampInt(
      args.frames,
      MIN_FRAMES,
      MAX_SHEET_FRAMES,
      DEFAULT_FRAMES,
    );
    const edge = clampInt(args.size, MIN_EDGE, MAX_EDGE, DEFAULT_EDGE);
    const art = artFolder(open.folder);
    if (!art) {
      return failure('The project has no art folder to write in.');
    }
    const names = Array.from({ length: count }, (_, index) =>
      frameName(name, index),
    );
    const taken = names.filter((file) => fs.existsSync(path.join(art, file)));
    if (taken.length > 0 && replace !== true) {
      return failure(
        `art/${taken[0]} is already there. Choose another name, or say replace: true to write over frames of this name.`,
      );
    }
    const answer = await deps.framesInWindow({
      video: new Uint8Array(read.bytes),
      type: read.type,
      count,
      edge,
      ...(typeof from === 'number' && from >= 0 ? { from } : {}),
      ...(typeof to === 'number' && to > 0 ? { to } : {}),
    });
    if (deps.signal().aborted) {
      return failure('The member stopped the reply.');
    }
    if (answer === 'no-window') {
      return failure(
        "FluidEQ's window is not open to draw the frames. Ask the member to open the Studio, then try again.",
      );
    }
    if (!answer.ok) {
      return failure(
        answer.reason === 'unreadable'
          ? `${video} cannot be played here: ask for it as an MP4 (H.264) or WebM.`
          : `The frames of ${video} could not be drawn.`,
      );
    }
    if (answer.frames.length !== count || !answer.frames.every(isPng)) {
      return failure(`The frames of ${video} could not be drawn.`);
    }
    answer.frames.forEach((frame, index) => {
      writeFileAtomically(path.join(art, names[index]), frame);
    });
    const listed = names.map((file) => `{ "from": "${ART_DIR}/${file}" }`);
    return {
      content: [
        text(
          [
            `Wrote ${count} frames of ${video} (${answer.duration.toFixed(2)} s long), each ${answer.width} x ${answer.height}: ${ART_DIR}/${names[0]} to ${ART_DIR}/${names[names.length - 1]}.`,
            `Lay them into the animation with build_sheet, name "${name}", frames [${listed.join(', ')}] - align "centre" for what flies or floats, the default baseline for what stands. A frame whose background is not flat keeps it: ask for the subject on a plain background, or take it out before you build.`,
            `Then look_at_animation("${name}") before you say it is done.`,
          ].join('\n'),
        ),
      ],
    };
  };

  return {
    name: 'video_frames',
    title: 'Turn a video into frames',
    description:
      "A scene plays no video, so a video becomes an animation: this draws evenly spaced frames of a video in the project's art folder - a clip made with Higgsfield, or the member's own - as art/<name>-01.png and on, which build_sheet then lays into an animation. Say the part of the video for one clean loop with from and to.",
    inputSchema: VIDEO_FRAMES_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    call,
  };
};

export default createVideoFramesTool;
