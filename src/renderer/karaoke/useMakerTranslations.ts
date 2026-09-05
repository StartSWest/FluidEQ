/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  addKaraokeTranslation,
  IKaraokeMakerProject,
  karaokeTranslationLanguages,
  KARAOKE_ORIGINAL_LANGUAGE,
  removeKaraokeTranslation,
} from '../../common/karaoke/makerProject';

/**
 * Which language the Maker is showing, and the add/remove/mismatch state that
 * goes with switching between them.
 *
 * `KaraokeMaker.tsx` is over 2,300 lines and none of this belongs on that
 * pile: the selected language is view state that outlives any one edit,
 * exactly like the editor view and the lyric draft, which already have
 * hooks of their own.
 */
const useMakerTranslations = (
  project: IKaraokeMakerProject,
  onProjectChange: (next: IKaraokeMakerProject) => void,
) => {
  // `karaokeTranslationLanguages` returns this exact expression as its first
  // entry. The sentinel is only the fallback for a project that never
  // declared a language — UltraStar imports populate a real tag from
  // `#LANGUAGE` (ultrastar.ts -> project.ts), and UltraStar is this app's
  // primary import format — so the bare `KARAOKE_ORIGINAL_LANGUAGE` constant
  // is not a reliable identity for "the original" and nothing below may
  // compare against it directly.
  const originalLanguage = project.lyrics.language ?? KARAOKE_ORIGINAL_LANGUAGE;
  const [language, setLanguage] = useState(originalLanguage);
  const [mismatch, setMismatch] = useState<
    { expected: number; received: number } | undefined
  >(undefined);

  const languages = useMemo(
    () => karaokeTranslationLanguages(project),
    [project],
  );

  // Reconciled synchronously during render, the same way the player's twin
  // does it (`karaokeLyricsTranslation.tsx`): a tag that is no longer offered
  // must never reach the Dropdown even for one frame, because the Dropdown
  // finds no entry for it and renders its trigger blank — and the remove
  // button's `disabled` guard, which compares against the original, goes
  // false, so a click commits a removal of nothing and spends an undo slot.
  //
  // Keyed on the offered list rather than on a project id, because neither
  // live path that invalidates the held tag changes an id reliably: the
  // wizard's `onLanguage` edits `lyrics.language` under the same project, and
  // opening a project replaces the whole thing while this hook stays mounted
  // — the Maker is keyed on the audio file, not on the project.
  const offeredRef = useRef(languages);
  if (offeredRef.current !== languages) {
    offeredRef.current = languages;
    if (!languages.includes(language)) {
      setLanguage(originalLanguage);
    }
  }

  // Returns the mismatch instead of leaving the caller to re-read `mismatch`
  // state a render later: `addKaraokeTranslation` already has the answer the
  // instant it runs, and a caller that needs to act on success (closing the
  // dialog) would otherwise have no way to tell "just succeeded" from
  // "never tried" out of state that starts and stays `undefined` either way.
  const addTranslation = useCallback(
    (text: string, target: string) => {
      const result = addKaraokeTranslation(project, text, target);
      setMismatch(result.mismatch);
      if (!result.mismatch && result.project !== project) {
        onProjectChange(result.project);
        setLanguage(target);
      }
      return result.mismatch;
    },
    [project, onProjectChange],
  );

  // Selecting a language whose sheet was just removed would leave the picker
  // pointing at a translation that no longer exists, so removal always lands
  // back on the original — the real one, not the sentinel.
  const removeTranslation = useCallback(
    (target: string) => {
      onProjectChange(removeKaraokeTranslation(project, target));
      setLanguage(originalLanguage);
    },
    [project, onProjectChange, originalLanguage],
  );

  return {
    language,
    setLanguage,
    languages,
    addTranslation,
    removeTranslation,
    mismatch,
    clearMismatch: useCallback(() => setMismatch(undefined), []),
  };
};

export default useMakerTranslations;
