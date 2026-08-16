/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerNote,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  karaokeMakerLineIsSection,
} from '../../common/karaoke/makerProject';

/**
 * The three edits every part of the Maker makes, in one place.
 *
 * Each is "replace one thing and mark the result manual" — the pattern behind
 * almost every change the editor makes to a project, and the reason it is
 * written once: `source: 'manual'` is what stops the next automatic pass
 * overwriting the user's own timing, and a copy that forgot it would lose work
 * silently, one note at a time.
 *
 * Shared out of the component because the pointer handlers need them too, and
 * a hook importing them from the component that imports the hook is a cycle.
 */
export const flattenTokens = (project: IKaraokeMakerProject) =>
  project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens);

export const replaceNote = (
  project: IKaraokeMakerProject,
  id: string,
  edit: (note: IKaraokeMakerNote) => IKaraokeMakerNote,
): IKaraokeMakerProject => ({
  ...project,
  melody: {
    ...project.melody,
    source: 'manual',
    notes: project.melody.notes.map((note) =>
      note.id === id ? { ...edit(note), source: 'manual' } : note,
    ),
  },
});

export const replaceToken = (
  project: IKaraokeMakerProject,
  id: string,
  edit: (token: IKaraokeMakerToken) => IKaraokeMakerToken,
): IKaraokeMakerProject => ({
  ...project,
  lyrics: {
    ...project.lyrics,
    source: 'manual',
    lines: project.lyrics.lines.map((line) => ({
      ...line,
      tokens: line.tokens.map((token) =>
        token.id === id
          ? { ...edit(token), source: 'manual', timingLocked: true }
          : token,
      ),
    })),
  },
});
