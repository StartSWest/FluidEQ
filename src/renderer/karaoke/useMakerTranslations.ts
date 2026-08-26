/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useMemo, useState } from 'react';
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
 * `KaraokeMaker.tsx` is 2,294 lines and none of this belongs on that pile: the
 * selected language is view state that outlives any one edit, exactly like the
 * editor view and the lyric draft, which already have hooks of their own.
 */
export const useMakerTranslations = (
  project: IKaraokeMakerProject,
  onProjectChange: (next: IKaraokeMakerProject) => void,
) => {
  const [language, setLanguage] = useState(KARAOKE_ORIGINAL_LANGUAGE);
  const [mismatch, setMismatch] = useState<
    { expected: number; received: number } | undefined
  >(undefined);

  const languages = useMemo(
    () => karaokeTranslationLanguages(project),
    [project],
  );

  const addTranslation = useCallback(
    (text: string, target: string) => {
      const result = addKaraokeTranslation(project, text, target);
      setMismatch(result.mismatch);
      if (!result.mismatch && result.project !== project) {
        onProjectChange(result.project);
        setLanguage(target);
      }
    },
    [project, onProjectChange],
  );

  // Selecting a language whose sheet was just removed would leave the picker
  // pointing at a translation that no longer exists, so removal always lands
  // back on the original.
  const removeTranslation = useCallback(
    (target: string) => {
      onProjectChange(removeKaraokeTranslation(project, target));
      setLanguage(KARAOKE_ORIGINAL_LANGUAGE);
    },
    [project, onProjectChange],
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
