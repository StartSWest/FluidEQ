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
import CompactFrame from './CompactFrame';
import '../styles/SpeechMemoryNotice.scss';

/**
 * Asks whether the idle speech model may give its RAM back.
 *
 * Asked the moment the Maker closes with nothing left transcribing — that is
 * what idle means now, not a wait (`whisperSession.ts`). Mounted at the app
 * root rather than inside the Karaoke workspace where the model lives, because
 * the Maker closes over whatever is behind it and the question has to be
 * where the user is. The session store is a module-level store with its own
 * subscription, so nothing about the model has to move for the question to
 * follow the user.
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
    // A notice over whatever page is open, not a gate: it blocks nothing.
    // Its × is "Keep loaded" — the answer that changes nothing.
    <CompactFrame
      className="speech-memory-notice"
      role="dialog"
      aria-modal="false"
      aria-describedby="speech-memory-notice-body"
      icon={<MenuIcon name="microphone" />}
      title={t('karaoke.maker.memoryPromptTitle')}
      titleId="speech-memory-notice-title"
      closeLabel={t('support.close')}
      onClose={keepKaraokeWhisperModelForNow}
      actions={
        <>
          <button
            type="button"
            className="button small subtle"
            onClick={keepKaraokeWhisperModelForNow}
          >
            {t('karaoke.maker.keepLoaded')}
          </button>
          {/* Loud, because it is the recommendation: the question is only
              asked once the Maker, the one thing that runs the model, has
              closed. */}
          <button
            type="button"
            className="button small"
            onClick={() => releaseKaraokeWhisperModel().catch(() => undefined)}
          >
            {t('karaoke.maker.freeMemory')}
          </button>
        </>
      }
    >
      <p id="speech-memory-notice-body">
        {t('karaoke.maker.memoryPromptBody')}
      </p>
    </CompactFrame>
  );
};

export default SpeechMemoryNotice;
