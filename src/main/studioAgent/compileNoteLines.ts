/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import studioStrings from '../../common/i18n/en/studio';
import {
  compileNotesFor,
  type TCompileNote,
} from '../../common/sceneCompileNotes';

/**
 * What a look says of how slowly the scene compiles on Windows, from the
 * Studio's own check (`sceneCompileNotes.ts`), in the words the member reads
 * under the stage. A picture cannot show it — a scene that takes half a
 * minute to load looks exactly like one that takes a second, once it plays —
 * and the AI is the one that can rewrite the shapes it names.
 */

const noteLine = (note: TCompileNote): string => {
  const key = `studio.compileNote.${note.code}` as const;
  const words = studioStrings[key]
    .replace('{name}', () => ('name' in note ? note.name : ''))
    .replace('{sites}', () => String('sites' in note ? note.sites : 0));
  return `- scene.frag, line ${note.line}: ${words}`;
};

const compileNoteLines = (source: string): string[] => {
  const notes = compileNotesFor(source);
  return notes.length === 0
    ? []
    : [
        'Slow to load on Windows (a warning: the scene plays, but every listener on Windows waits for it to compile; see HOW TO KEEP IT QUICK TO BUILD and fix it before you finish):',
        ...notes.map(noteLine),
      ];
};

export default compileNoteLines;
