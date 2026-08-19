/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED,
  getKaraokeWhisperSessionSnapshot,
  keepKaraokeWhisperModelForNow,
  releaseKaraokeWhisperModel,
  subscribeKaraokeWhisperSession,
} from '../karaoke/makerAi';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import '../styles/SpeechMemoryNotice.scss';

/**
 * Asks whether the idle speech model may give its RAM back.
 *
 * Mounted at the app root, not inside the Karaoke workspace where the model
 * lives. The idle timer that raises this runs for as long as the model is
 * loaded, and the user is very unlikely to still be looking at the Maker ten
 * minutes after they stopped using it — so drawn inside that tab, the question
 * was asked to an empty room and the gigabyte stayed held until they wandered
 * back. The session store is a module-level store with its own subscription,
 * so nothing about the model has to move for the question to follow the user.
 *
 * Nothing when there is nothing to ask: the prompt is only raised under the
 * `ask` policy, and `auto` releases silently while `keep` never asks at all.
 */
const SpeechMemoryNotice = () => {
  const { t } = useTranslation();
  const session = useSyncExternalStore(
    subscribeKaraokeWhisperSession,
    getKaraokeWhisperSessionSnapshot,
    getKaraokeWhisperSessionSnapshot,
  );

  if (!KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED || !session.releasePrompt) {
    return null;
  }

  return (
    <div
      className="speech-memory-notice"
      role="dialog"
      aria-labelledby="speech-memory-notice-title"
      aria-describedby="speech-memory-notice-body"
    >
      <MenuIcon name="microphone" className="speech-memory-notice__icon" />
      <div className="speech-memory-notice__text">
        <strong id="speech-memory-notice-title">
          {t('karaoke.maker.memoryPromptTitle')}
        </strong>
        <span id="speech-memory-notice-body">
          {t('karaoke.maker.memoryPromptBody')}
        </span>
      </div>
      <div className="speech-memory-notice__actions">
        <button
          type="button"
          className="button small subtle"
          onClick={keepKaraokeWhisperModelForNow}
        >
          {t('karaoke.maker.keepLoaded')}
        </button>
        {/* Loud, because it is the recommendation: the question is only asked
            after the model has sat unused for the whole idle window. */}
        <button
          type="button"
          className="button small"
          onClick={() => releaseKaraokeWhisperModel().catch(() => undefined)}
        >
          {t('karaoke.maker.freeMemory')}
        </button>
      </div>
    </div>
  );
};

export default SpeechMemoryNotice;
