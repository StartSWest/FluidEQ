/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IStudioChatStep, TStudioChatEntry } from 'common/studioChat';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import ChatText from './ChatText';
import StudioChatCopy from './StudioChatCopy';
import { pictureKey, stepLabel } from './chatPictureList';
import { CLAUDE_CODE_INSTALL_URL } from './StudioChatSetup';
import {
  restoreStudioChatVersion,
  signInToStudioChat,
  useStudioChat,
} from './studioChatStore';
import '../../styles/StudioChatReply.scss';

type TReply = Extract<TStudioChatEntry, { kind: 'claude' }>;

const FAILURE_WORDS: Record<NonNullable<TReply['failure']>, TranslationKey> = {
  missing: 'studioChat.failed.missing',
  'signed-out': 'studioChat.failed.signedOut',
  limit: 'studioChat.failed.limit',
  crashed: 'studioChat.failed.crashed',
};

/**
 * Steps that would read the same twice in a row — the scene file changed in
 * three edits — shown once, as the last of them. Reads and searches fold
 * whatever their file: what was read is never the point. Looks never fold:
 * each is a picture of its own, and seeing every one is the point (Ivan,
 * 2026-10-09: "so I can see all the time what is looking at").
 */
const shownSteps = (steps: readonly IStudioChatStep[]) =>
  steps.filter((step, index) => {
    const next = steps[index + 1];
    const quiet = step.kind === 'read' || step.kind === 'search';
    return !(
      next &&
      step.kind !== 'look' &&
      next.kind === step.kind &&
      (quiet || next.file === step.file) &&
      step.state !== 'running'
    );
  });

function Step({ step, onOpen }: { step: IStudioChatStep; onOpen: () => void }) {
  const { t, locale } = useTranslation();
  const tokenCount = useMemo(
    () => new Intl.NumberFormat(locale, { notation: 'compact' }),
    [locale],
  );
  const running = step.state === 'running';
  const label = stepLabel(t, step);
  return (
    <li className={`studio-chat__step is-${step.state}`}>
      <span className="studio-chat__step-mark" aria-hidden="true">
        {step.state === 'done' && <Glyph name="check" />}
        {step.state === 'failed' && <Glyph name="alert" />}
      </span>
      <span>{label}</span>
      {step.tokens && (
        <span className="studio-chat__step-note">
          {t('studioChat.step.compactTokens', {
            before: tokenCount.format(step.tokens.before),
            after: tokenCount.format(step.tokens.after),
          })}
        </span>
      )}
      {/* What the look is drawing, or ChatGPT is painting, held open while
          it works, then the picture itself, the moment it comes back. */}
      {(step.kind === 'look' || step.kind === 'picture') && running && (
        <span className="studio-chat__seen is-drawing" aria-hidden="true" />
      )}
      {step.picture && (
        <button
          type="button"
          className={`studio-chat__seen${
            step.kind === 'picture' ? ' is-made' : ''
          }`}
          aria-label={t('studioChat.seenLarger')}
          aria-haspopup="dialog"
          onClick={onOpen}
        >
          <img src={step.picture} alt={label} />
        </button>
      )}
    </li>
  );
}

interface IStudioChatReplyProps {
  reply: TReply;
  /** This reply's version is the one on the stage. */
  playing: boolean;
  /** Offered on a reply cut short, the last in the chat. */
  onCarryOn?: () => void;
  /**
   * The last reply, failed: answers it again. A sign-in from its card ends
   * with it, so the message goes on its own (Ivan, 2026-10-16: "after
   * signed in with claude it needs to auto refresh").
   */
  onRetry?: () => void;
  /** Opens the viewer on one of the chat's pictures, by its key. */
  onOpenPicture: (key: string) => void;
}

export default function StudioChatReply({
  reply,
  playing,
  onCarryOn,
  onRetry,
  onOpenPicture,
}: IStudioChatReplyProps) {
  const { t } = useTranslation();
  const { signingIn } = useStudioChat();
  const [restore, setRestore] = useState<
    'idle' | 'running' | 'done' | 'failed'
  >('idle');
  const working = reply.state === 'working';
  const steps = shownSteps(reply.steps);
  const bringBack = () => {
    setRestore('running');
    restoreStudioChatVersion(reply.id)
      .then((answer) => {
        setRestore(answer.ok ? 'done' : 'failed');
        return undefined;
      })
      .catch(() => setRestore('failed'));
  };

  return (
    <article
      className={`studio-chat__reply is-${reply.state}`}
      aria-busy={working}
      aria-label={t('studioChat.claude')}
    >
      {steps.length > 0 && (
        <ol className="studio-chat__steps">
          {steps.map((step) => (
            <Step
              key={step.id}
              step={step}
              onOpen={() => onOpenPicture(pictureKey(reply.id, step.id))}
            />
          ))}
        </ol>
      )}
      {reply.version !== undefined && (
        <div className="studio-chat__version">
          <span className="studio-chat__version-mark" aria-hidden="true">
            <Glyph name="check" />
          </span>
          <span className="studio-chat__version-words">
            <strong>
              {t('studioChat.version', { version: reply.version })}
            </strong>
            {playing && <span>{t('studioChat.playing')}</span>}
            {restore === 'done' && (
              <span role="status">{t('studioChat.broughtBack')}</span>
            )}
            {restore === 'failed' && (
              <span role="alert">{t('studioChat.bringBackFailed')}</span>
            )}
          </span>
          {!playing && (
            <button
              type="button"
              className="button small subtle"
              disabled={restore === 'running'}
              onClick={bringBack}
            >
              {t('studioChat.bringBack')}
            </button>
          )}
        </div>
      )}
      {reply.text && (
        <div className="studio-chat__text">
          <ChatText text={reply.text} />
        </div>
      )}
      {/* Between the steps Claude is thinking, and the stream says nothing
          while it does: without this a reply with every step ticked read as
          finished, or stuck (Ivan, 2026-10-09: "I dont see is doing
          something"). Always at the reply's foot until it ends. */}
      {working && !steps.some((step) => step.state === 'running') && (
        <p className="studio-chat__thinking" role="status">
          <span className="studio-chat__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {t('studioChat.thinking')}
        </p>
      )}
      {reply.state === 'stopped' && (
        <p className="studio-chat__ended">{t('studioChat.stopped')}</p>
      )}
      {reply.state === 'failed' && reply.failure && (
        <div className="studio-chat__failure" role="alert">
          <Glyph name="alert" />
          <span>{t(FAILURE_WORDS[reply.failure])}</span>
          {reply.failure === 'signed-out' && (
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
          )}
          {reply.failure === 'missing' && (
            <button
              type="button"
              className="button small"
              onClick={() =>
                window.open(CLAUDE_CODE_INSTALL_URL, '_blank', 'noopener')
              }
            >
              {t('studioChat.install')}
            </button>
          )}
        </div>
      )}
      {/* The reply's words, to copy, once it has ended. */}
      {reply.text && !working && (
        <div className="studio-chat__turn-actions">
          <StudioChatCopy text={reply.text} />
        </div>
      )}
      {onCarryOn && (
        <div className="studio-chat__carry">
          <button type="button" className="button small" onClick={onCarryOn}>
            <Glyph name="refresh" />
            {t('studioChat.carryOn')}
          </button>
        </div>
      )}
    </article>
  );
}
