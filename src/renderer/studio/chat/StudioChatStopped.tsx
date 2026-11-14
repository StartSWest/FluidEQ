/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { TStudioChatEntry } from 'common/studioChat';
import type {
  TStudioChatFailure,
  TStudioChatLimitHit,
} from 'common/studioChatStop';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { useLimitTimes } from './StudioChatLimits';
import { CLAUDE_CODE_INSTALL_URL } from './StudioChatSetup';
import {
  compactStudioChat,
  signInToStudioChat,
  useStudioChat,
} from './studioChatStore';

type TReply = Extract<TStudioChatEntry, { kind: 'claude' }>;

/** Fable's limit has a card of its own (`StudioChatFableLimit`). */
type TStopped = Exclude<TStudioChatFailure, 'fable-limit'>;

const WORDS: Record<TStopped, TranslationKey> = {
  missing: 'studioChat.failed.missing',
  'signed-out': 'studioChat.failed.signedOut',
  limit: 'studioChat.failed.limit',
  subscription: 'studioChat.failed.subscription',
  network: 'studioChat.failed.network',
  server: 'studioChat.failed.server',
  'too-long': 'studioChat.failed.tooLong',
  crashed: 'studioChat.failed.crashed',
};

const LIMIT_WORDS: Record<TStudioChatLimitHit, TranslationKey> = {
  fiveHour: 'studioChat.failed.limitFiveHour',
  week: 'studioChat.failed.limitWeek',
  opus: 'studioChat.failed.limitOpus',
};

/**
 * Why a reply stopped short, said where it stands, with what the member can
 * do about it (Ivan, 2026-11-13: "make sure the chat shows the messages
 * well, like the session limit for Fable and Opus, or if it needs to
 * re-login"). Every reason Claude Code names has words of its own
 * (`common/studioChatStop.ts`); the line "stopped before it finished" is
 * left for a stop it named nothing the chat knows about, and then Claude
 * Code's own words stand under it, as it wrote them.
 *
 * The action that mends the stop is the loud one: signing in, trying again
 * once the connection or Claude's side is back, compacting a chat that grew
 * too long. Trying again on a limit or an unpaid plan is the quiet one: it
 * only works once the limit has reset or the plan is in order.
 */
export default function StudioChatStopped({
  reply,
  failure,
  onRetry,
}: {
  reply: TReply;
  failure: TStopped;
  /** The last reply, with nothing being written: it can go again. */
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const { signingIn, limits } = useStudioChat();
  const times = useLimitTimes();
  const hit = failure === 'limit' ? reply.limit?.window : undefined;
  // When the limit is back: as Claude Code said with the stop, else as the
  // plan's last reading has that window, where that is still ahead.
  const read = hit ? limits?.[hit]?.resetsAt : undefined;
  const resetsAt =
    failure === 'limit'
      ? (reply.limit?.resetsAt ??
        (read !== undefined && read > Date.now() ? read : undefined))
      : undefined;

  const tryAgain = (loud: boolean): ReactNode =>
    onRetry && (
      <button
        type="button"
        className={`button small${loud ? '' : ' subtle'}`}
        onClick={onRetry}
      >
        {t('notice.tryAgain')}
      </button>
    );

  const action = (): ReactNode => {
    switch (failure) {
      case 'missing':
        return (
          <button
            type="button"
            className="button small"
            onClick={() =>
              window.open(CLAUDE_CODE_INSTALL_URL, '_blank', 'noopener')
            }
          >
            {t('studioChat.install')}
          </button>
        );
      case 'signed-out':
        return (
          <button
            type="button"
            className={`button small${signingIn ? ' is-running' : ''}`}
            aria-busy={signingIn}
            disabled={signingIn}
            onClick={() => {
              signInToStudioChat()
                .then((answer) => {
                  if (answer?.state === 'ready') {
                    onRetry?.();
                  }
                  return undefined;
                })
                .catch(() => undefined);
            }}
          >
            {t('studioChat.signIn')}
          </button>
        );
      case 'network':
      case 'server':
        return tryAgain(true);
      case 'limit':
      case 'subscription':
        return tryAgain(false);
      case 'too-long':
        return (
          onRetry && (
            <button
              type="button"
              className="button small"
              onClick={() => {
                compactStudioChat().catch(() => undefined);
              }}
            >
              {t('studioChat.compact.label')}
            </button>
          )
        );
      default:
        // "Carry on" stands under the reply (`StudioChatReply`).
        return undefined;
    }
  };
  const offered = action();

  return (
    <div className="studio-chat__failure studio-chat__fable" role="alert">
      <Glyph name="alert" />
      <span>{t(hit ? LIMIT_WORDS[hit] : WORDS[failure])}</span>
      {resetsAt !== undefined && (
        <p className="studio-chat__fable-note">
          {t('studioChat.limits.resets', {
            time: (hit ? times.of(hit) : times.dayAndTime).format(resetsAt),
          })}
        </p>
      )}
      {failure === 'crashed' && reply.said && (
        <p className="studio-chat__fable-note">
          {t('studioChat.failed.said', { words: reply.said })}
        </p>
      )}
      {offered && <div className="studio-chat__fable-actions">{offered}</div>}
    </div>
  );
}
