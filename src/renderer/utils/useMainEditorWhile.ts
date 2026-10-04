/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import { reportError } from './logger';
import { useOutputEditor } from './outputEditor';
import useMainOutputEditor from './useMainOutputEditor';

/**
 * Whether the output being edited is the one playing — or no output is known
 * to be playing yet, when there is nothing else it could be.
 */
export const useIsMainEdited = (): boolean => {
  const { editor, main } = useOutputEditor();
  return !main || editor?.device.id === main.id;
};

/**
 * While `isActive`, the editor is the main output.
 *
 * For a surface that speaks for the machine's own sound: the amp's faders,
 * its game mode, a game's sound. Each edits the rack and bands of whichever
 * output is being edited, so with a second output left in "Edit sound" they
 * changed that output instead, with nothing on screen to say so — the
 * editing notice lives on pages the amp puts to sleep. Entering such a
 * surface ends the edit, the way pressing Done does.
 */
const useMainEditorWhile = (isActive: boolean): void => {
  const enterMainEditor = useMainOutputEditor();
  const isMainEdited = useIsMainEdited();
  useEffect(() => {
    if (isActive && !isMainEdited) {
      enterMainEditor().catch((error: unknown) =>
        reportError('Could not return the editor to the main output', error),
      );
    }
  }, [isActive, isMainEdited, enterMainEditor]);
};

export default useMainEditorWhile;
