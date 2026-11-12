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
 * Pictures Claude made — with Higgsfield, a script, the member's own image
 * skill or plugin — shown in the chat the
 * moment the step that wrote them ends (Ivan, 2026-11-09: "shows generated
 * images right there in the chat", "click them and zoom them like the other
 * I attach"). One was made and saved into `art/` and the member never saw
 * it: the chat showed only "Worked on the scene", and Claude opened it in
 * another program. Only the project's own folder and its `art/` are looked
 * in, and only plain PNG and JPEG files, the two the chat can show.
 *
 * What a step wrote is what differs from the folder as it stood when the
 * step began - a picture that was not there, or one whose write time or size
 * moved - never what was written after a clock reading: Windows stamps a
 * file's write time from a clock that can trail `Date.now()` by a tick
 * (~15.6 ms), so a picture written in the first milliseconds of a fast step
 * read as older than the step and was left out (the full suite caught it).
 */

const PICTURE_FILE = /\.(png|jpe?g)$/i;
/** A step that writes more is making frames, not pictures to look at. */
const MOST_PER_STEP = 4;
const MAX_PICTURE_BYTES = 16 * 1024 * 1024;

interface IPictureFile {
  file: string;
  name: string;
  written: number;
  size: number;
}

/** The project's pictures as a step begins, by path: write time and size. */
export type TPictureSnapshot = ReadonlyMap<
  string,
  { written: number; size: number }
>;

/** Plain picture files in `dir`. */
const picturesIn = (dir: string): IPictureFile[] => {
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
        stats.size <= MAX_PICTURE_BYTES
        ? [{ file, name, written: stats.mtimeMs, size: stats.size }]
        : [];
    } catch {
      return [];
    }
  });
};

const picturesOf = (folder: string) => [
  ...picturesIn(folder),
  ...picturesIn(path.join(folder, ART_DIR)),
];

/** The folder's pictures now, to tell later what a step wrote. */
export const snapshotPictures = (folder: string): TPictureSnapshot =>
  new Map(
    picturesOf(folder).map(({ file, written, size }) => [
      file,
      { written, size },
    ]),
  );

/** The pictures new or changed since `before`, as chat steps, oldest first. */
export const madePictureSteps = (
  folder: string,
  before: TPictureSnapshot,
  stepId: string,
): IStudioChatStep[] =>
  picturesOf(folder)
    .filter(({ file, written, size }) => {
      const was = before.get(file);
      return !was || was.written !== written || was.size !== size;
    })
    .sort((a, b) => a.written - b.written)
    .slice(-MOST_PER_STEP)
    .flatMap(({ file, name }, index): IStudioChatStep[] => {
      let bytes: Buffer;
      try {
        bytes = fs.readFileSync(file);
      } catch {
        return [];
      }
      // A PNG keeps its transparency, as a cut-out needs.
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
 * A step that brought a picture back itself (a look, a read of a picture)
 * already shows it.
 */
export const withMadePictures = (
  reply: TReply,
  stepId: string,
  folder: string,
  before: TPictureSnapshot,
): TReply => {
  const at = reply.steps.findIndex((step) => step.id === stepId);
  const step = reply.steps[at];
  if (!step || step.kind !== 'other' || step.picture) {
    return reply;
  }
  const made = madePictureSteps(folder, before, stepId);
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
