/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useState } from 'react';
import { toggleFavouriteDspPreset } from '../../dsp/favouriteDspPresets';

/** The last star given or taken in this opening, for the strip's Undo. */
export interface IStarNote {
  kind: 'add' | 'remove';
  id: string;
}

const without = (set: ReadonlySet<string>, id: string): Set<string> => {
  const next = new Set(set);
  next.delete(id);
  return next;
};

/**
 * The stars given and taken from the titlebar plate's panel, written to the
 * one list the Preset tab and both pickers star into
 * (`toggleFavouriteDspPreset`), so every one of them agrees at once.
 *
 * A star taken away leaves its row where it stood, dimmed, until the panel
 * closes (`gone`): the favourites below it would otherwise move up under the
 * pointer, and the next press would land on the row after the one meant.
 *
 * `known` is every id the app can show, so the stars of presets that are
 * gone are dropped with the write; `starred` is the list as it stands.
 */
const useFavouriteEdits = (
  isOpen: boolean,
  known: readonly string[],
  starred: ReadonlySet<string>,
) => {
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const [note, setNote] = useState<IStarNote | undefined>(undefined);

  // A panel opened again starts with nothing dimmed and nothing to undo.
  useLayoutEffect(() => {
    if (!isOpen) {
      setGone(new Set());
      setNote(undefined);
    }
  }, [isOpen]);

  const toggle = (id: string) => {
    const isStarred = starred.has(id);
    toggleFavouriteDspPreset(id, known);
    if (isStarred) {
      setGone((current) => new Set(current).add(id));
      setNote({ kind: 'remove', id });
    } else {
      setGone((current) => without(current, id));
      setNote({ kind: 'add', id });
    }
  };

  /**
   * The last star put back as it was. A star given and undone leaves no
   * dimmed row behind: it was never one of the favourites.
   */
  const undo = () => {
    if (!note) {
      return;
    }
    if (note.kind === 'remove' && !starred.has(note.id)) {
      toggleFavouriteDspPreset(note.id, known);
      setGone((current) => without(current, note.id));
    } else if (note.kind === 'add' && starred.has(note.id)) {
      toggleFavouriteDspPreset(note.id, known);
    }
    setNote(undefined);
  };

  return {
    gone,
    note,
    toggle,
    undo,
    /** The strip back to its keys: typing moves the panel on from a star. */
    dismiss: () => setNote(undefined),
  };
};

export default useFavouriteEdits;
