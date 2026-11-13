/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import { isStudioChatModelOffered } from 'common/studioChat';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { fableResetOf, opusRoomOf } from './fableLimit';
import { LIMIT_NAMES, useLimitTimes } from './StudioChatLimits';
import { useStudioChatModels } from './studioChatModels';
import {
  checkStudioChatLimits,
  retryStudioChatOn,
  useStudioChat,
} from './studioChatStore';

/**
 * A reply Fable's own limit stopped (Ivan, 2026-11-13: "when fable reaches
 * the session limit show that in the chat and ask to change to opus if
 * there is still session room for opus"): said where the reply stands,
 * with when Fable is back, and Opus offered only on a reading taken after
 * the reply ended that leaves Opus room. Opus's room is read from the
 * plan's windows (`opusRoomOf`); a reading from before the wall is not
 * believed, because the reply that hit it spent some of the plan too, so
 * until a new one arrives the card says it is checking. Nothing switches
 * on its own: the member presses, the chat's model becomes Opus and the
 * message goes again; "Not now" leaves the chat as it is.
 */
export default function StudioChatFableLimit({
  canRetry,
}: {
  /** The last reply, with nothing being written: it can go again. */
  canRetry: boolean;
}) {
  const { t } = useTranslation();
  const { limits } = useStudioChat();
  const models = useStudioChatModels();
  const times = useLimitTimes();
  const [shownAt] = useState(() => Date.now());
  const [declined, setDeclined] = useState(false);
  const [switching, setSwitching] = useState(false);

  // A reading of the plan after the wall: the one asked at the reply's end
  // usually lands first; a chat opened later asks for its own.
  useEffect(() => {
    if (canRetry) {
      checkStudioChatLimits().catch(() => undefined);
    }
  }, [canRetry]);

  const now = Date.now();
  const back = fableResetOf(limits, now);
  const fresh = limits !== undefined && limits.at >= shownAt;
  const room = fresh ? opusRoomOf(limits, now) : undefined;
  const offering =
    canRetry && !declined && isStudioChatModelOffered(models, 'opus');

  let next = null;
  if (offering && !room) {
    next = (
      <p className="studio-chat__fable-note" role="status">
        {t('studioChat.fable.checking')}
      </p>
    );
  } else if (offering && room?.state === 'room') {
    next = (
      <>
        <p className="studio-chat__fable-note">
          {t('studioChat.fable.opusRoom')}
        </p>
        <div className="studio-chat__fable-actions">
          <button
            type="button"
            className={`button small${switching ? ' is-running' : ''}`}
            aria-busy={switching}
            disabled={switching}
            onClick={() => {
              setSwitching(true);
              retryStudioChatOn('opus')
                .catch(() => undefined)
                .finally(() => setSwitching(false));
            }}
          >
            {t('studioChat.fable.switch')}
          </button>
          <button
            type="button"
            className="button small subtle"
            disabled={switching}
            onClick={() => setDeclined(true)}
          >
            {t('studioChat.fable.notNow')}
          </button>
        </div>
      </>
    );
  } else if (offering && room?.state === 'full') {
    next = (
      <div className="studio-chat__fable-note">
        <p>{t('studioChat.fable.opusFull')}</p>
        <ul className="studio-chat__fable-resets">
          {room.spent.map(({ window, resetsAt }) => (
            <li key={window}>
              {t(LIMIT_NAMES[window])}
              {' · '}
              {t('studioChat.limits.resets', {
                time: times.of(window).format(resetsAt),
              })}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="studio-chat__failure studio-chat__fable" role="alert">
      <Glyph name="alert" />
      <span>
        {t('studioChat.failed.fableLimit')}
        {back !== undefined &&
          ` ${t('studioChat.fable.back', {
            time: times.dayAndTime.format(back),
          })}`}
      </span>
      {next}
    </div>
  );
}
