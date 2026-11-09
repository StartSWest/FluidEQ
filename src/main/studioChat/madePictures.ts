/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import type {
  IStudioChatStep,
  TStudioChatEntry,
} from '../../common/studioChat';
import { ART_DIR } from './artFolder';
import {
  chatPictureFromBytes,
  chatPictureKeepingAlphaBytes,
} from './chatPicture';

type TReply = Extract<TStudioChatEntry, { kind: 'claude' }>;

/**
 * Pictures Claude made some other way than FluidEQ's own `make_picture` — a
 * script, the member's own image skill or plugin — shown in the chat the
 * moment the step that wrote them ends (Ivan, 2026-11-09: "shows generated
 * images right there in the chat", "click them and zoom them like the other
 * I attach"). One was made and saved into `art/` and the member never saw
 * it: the chat showed only "Worked on the scene", and Claude opened it in
 * another program. Only the project's own folder and its `art/` are looked
 * in, and only plain PNG and JPEG files, the two the chat can show.
 */

const PICTURE_FILE = /\.(png|jpe?g)$/i;
/** A step that writes more is making frames, not pictures to look at. */
const MOST_PER_STEP = 4;
const MAX_PICTURE_BYTES = 16 * 1024 * 1024;

/** Plain picture files in `dir` written at or after `since`, oldest first. */
const writtenSince = (dir: string, since: number) => {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    if (!PICTURE_FILE.test(name)) {
      return [];
    }
    const file = path.join(dir, name);
    try {
      const stats = fs.lstatSync(file);
      return stats.isFile() &&
        stats.nlink === 1 &&
        stats.size <= MAX_PICTURE_BYTES &&
        stats.mtimeMs >= since
        ? [{ file, name, written: stats.mtimeMs }]
        : [];
    } catch {
      return [];
    }
  });
};

/** The pictures written in the project since `since`, as chat steps. */
export const madePictureSteps = (
  folder: string,
  since: number,
  stepId: string,
): IStudioChatStep[] =>
  [
    ...writtenSince(folder, since),
    ...writtenSince(path.join(folder, ART_DIR), since),
  ]
    .sort((a, b) => a.written - b.written)
    .slice(-MOST_PER_STEP)
    .flatMap(({ file, name }, index): IStudioChatStep[] => {
      let bytes: Buffer;
      try {
        bytes = fs.readFileSync(file);
      } catch {
        return [];
      }
      // A PNG keeps its transparency, as ChatGPT's cut-outs do.
      const picture = /\.png$/i.test(name)
        ? chatPictureKeepingAlphaBytes(bytes)
        : chatPictureFromBytes(bytes);
      return picture
        ? [
            {
              id: `${stepId}/made-${index}`,
              kind: 'picture',
              file: name,
              state: 'done',
              picture,
            },
          ]
        : [];
    });

/**
 * The reply with the pictures a finished step wrote shown right after it.
 * A step that brought a picture back itself (a look, a read of a picture,
 * `make_picture`) already shows it.
 */
export const withMadePictures = (
  reply: TReply,
  stepId: string,
  folder: string,
  since: number,
): TReply => {
  const at = reply.steps.findIndex((step) => step.id === stepId);
  const step = reply.steps[at];
  if (!step || step.kind !== 'other' || step.picture) {
    return reply;
  }
  const made = madePictureSteps(folder, since, stepId);
  return made.length === 0
    ? reply
    : {
        ...reply,
        steps: [
          ...reply.steps.slice(0, at + 1),
          ...made,
          ...reply.steps.slice(at + 1),
        ],
      };
};
