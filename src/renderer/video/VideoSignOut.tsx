/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useState } from 'react';
import ChannelEnum from 'common/channels';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { sendRequest, simpleResponseHandler } from '../utils/ipcRequest';
import isOwnAnimationEnd from '../utils/ownAnimationEnd';

type TSignOutState = 'idle' | 'clearing' | 'done' | 'failed';

const WORDS: Record<TSignOutState, TranslationKey> = {
  idle: 'video.signOut',
  clearing: 'video.signOutBusy',
  done: 'video.signOutDone',
  failed: 'video.signOutFailed',
};

/**
 * THE OTHER HALF OF A SESSION THAT REMEMBERS, a row in the rail's foot.
 *
 * The player keeps cookies, so that signing in is worth doing - and the
 * moment it does, somebody has to be able to undo it. Always there, unlike
 * the ad-block switch behind its chord: a privacy control that has to be
 * discovered is one most people never find. It was a lone door at the end of
 * the toolbar with its words in a tooltip; in the rail it says them.
 *
 * It says what it did, too: the row's words and glyph become "Signed out"
 * and a tick, or the failure and a cross, for the glyph's own hold
 * (`video-sign-out-said`), whose end brings the door back. Left up, "Signed
 * out" would still be on screen the next time somebody looked to check
 * whether they were - the one question this control exists to answer,
 * answered wrongly.
 *
 * One value rather than three booleans: a clear can be in flight, can have
 * worked or can have failed, and those are exclusive. A request rather than
 * a standing listener: the reply belongs to the press that asked for it.
 * The main process does the clearing and sends every player home after, so
 * there is nothing to reload from here.
 */
const VideoSignOut = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<TSignOutState>('idle');
  const signOut = useCallback(() => {
    setState('clearing');
    sendRequest(
      ChannelEnum.CLEAR_VIDEO_SESSION,
      [],
      simpleResponseHandler<boolean>(),
    ).then(
      (cleared) => setState(cleared ? 'done' : 'failed'),
      () => setState('failed'),
    );
  }, []);
  return (
    <button
      type="button"
      className={`video-rail__item video-rail__sign-out is-${state}`}
      onClick={signOut}
      disabled={state === 'clearing'}
      title={t('video.signOutHint')}
      // Its name whether or not the folded rail shows the words.
      aria-label={t(WORDS[state])}
      aria-live="polite"
    >
      <svg
        className="video-rail__icon"
        viewBox="0 0 16 16"
        aria-hidden
        onAnimationEnd={(event) => {
          if (isOwnAnimationEnd(event, 'video-sign-out-said')) {
            setState('idle');
          }
        }}
      >
        {state === 'done' && <path d="M3.5 8.4l3 3 6-6.6" />}
        {state === 'failed' && <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />}
        {(state === 'idle' || state === 'clearing') && (
          // A door with an arrow leaving it.
          <>
            <path d="M9.5 2.5h-6v11h6" />
            <path d="M7.5 8h7M11.5 5l3 3-3 3" />
          </>
        )}
      </svg>
      <span className="video-rail__label studio-rail__word">
        {t(WORDS[state])}
      </span>
    </button>
  );
};

export default VideoSignOut;
