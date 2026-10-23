/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import type { TStudioChatAsk, TStudioChatCodex } from 'common/studioChat';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import {
  answerStudioChat,
  checkStudioChatCodex,
  signInToStudioChatCodex,
  useStudioChat,
} from './studioChatStore';
import '../../styles/StudioChatAsk.scss';

/** OpenAI's own page for the Codex app, on every platform it ships for. */
export const CODEX_APP_URL = 'https://developers.openai.com/codex/app';

/** Connecting ChatGPT: what Codex needs first, then the yes or no. */
function ConnectCard({
  ask,
  codex,
}: {
  ask: Extract<TStudioChatAsk, { kind: 'connect' }>;
  codex: TStudioChatCodex;
}) {
  const { t } = useTranslation();
  const { codexSigningIn } = useStudioChat();
  let lead;
  if (codex === 'missing') {
    lead = (
      <button
        type="button"
        className="button small"
        onClick={() => window.open(CODEX_APP_URL, '_blank', 'noopener')}
      >
        {t('studioChat.ask.getCodex')}
      </button>
    );
  } else if (codex === 'signed-out') {
    lead = (
      <button
        type="button"
        className={`button small${codexSigningIn ? ' is-running' : ''}`}
        disabled={codexSigningIn}
        onClick={() => {
          signInToStudioChatCodex().catch(() => undefined);
        }}
      >
        {t('studioChat.ask.signIn')}
      </button>
    );
  } else {
    lead = (
      <button
        type="button"
        className="button small"
        onClick={() => {
          answerStudioChat(ask.id, 'yes').catch(() => undefined);
        }}
      >
        {t('studioChat.ask.connect')}
      </button>
    );
  }
  return (
    <>
      <p className="studio-chat__ask-title">
        {t('studioChat.ask.connectTitle')}
      </p>
      <p className="studio-chat__ask-body">{t('studioChat.ask.connectBody')}</p>
      {codex !== 'ready' && (
        <p className="studio-chat__ask-need">
          {t(
            codex === 'missing'
              ? 'studioChat.ask.needsCodex'
              : 'studioChat.ask.codexSignedOut',
          )}
        </p>
      )}
      <div className="studio-chat__ask-actions">
        {lead}
        <button
          type="button"
          className="button small subtle"
          onClick={() => {
            answerStudioChat(ask.id, 'no').catch(() => undefined);
          }}
        >
          {t('studioChat.ask.notNow')}
        </button>
      </div>
    </>
  );
}

/** One picture: what it is for, what ChatGPT is asked to draw, its size. */
function PictureCard({
  ask,
}: {
  ask: Extract<TStudioChatAsk, { kind: 'picture' }>;
}) {
  const { t } = useTranslation();
  const answer = (choice: 'yes' | 'chat' | 'no') => {
    answerStudioChat(ask.id, choice).catch(() => undefined);
  };
  return (
    <>
      <p className="studio-chat__ask-title">
        {t('studioChat.ask.pictureTitle')}
      </p>
      <p className="studio-chat__ask-why">{ask.why}</p>
      <blockquote className="studio-chat__ask-prompt">{ask.prompt}</blockquote>
      <p className="studio-chat__ask-meta">
        <span>
          {t('studioChat.ask.pictureSize', {
            width: ask.width,
            height: ask.height,
          })}
        </span>
        {ask.transparent && <span>{t('studioChat.ask.transparent')}</span>}
        <span>{t('studioChat.ask.cost')}</span>
      </p>
      <div className="studio-chat__ask-actions">
        <button
          type="button"
          className="button small"
          onClick={() => answer('yes')}
        >
          {t('studioChat.ask.makeIt')}
        </button>
        <button
          type="button"
          className="button small subtle"
          onClick={() => answer('chat')}
        >
          {t('studioChat.ask.allowChat')}
        </button>
        <button
          type="button"
          className="button small subtle"
          onClick={() => answer('no')}
        >
          {t('studioChat.ask.notNow')}
        </button>
      </div>
    </>
  );
}

/**
 * The card Claude's use of ChatGPT waits on (Ivan, 2026-10-09: "it needs to
 * ask the user if you connect gpt codex … and also ask when it will use
 * it"), at the foot of the conversation where the reply stands waiting.
 * Codex's state is asked again while the card is up and whenever the window
 * comes back, so installing Codex or signing in elsewhere turns "Get Codex"
 * into "Connect" without anything to press.
 */
export default function StudioChatAsk({ ask }: { ask: TStudioChatAsk }) {
  const { t } = useTranslation();
  const { codex } = useStudioChat();
  const connecting = ask.kind === 'connect';

  useEffect(() => {
    if (!connecting) {
      return undefined;
    }
    checkStudioChatCodex().catch(() => undefined);
    const onFocus = () => {
      checkStudioChatCodex().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [connecting]);

  return (
    <section
      className="studio-chat__ask"
      aria-label={t(
        connecting
          ? 'studioChat.ask.connectTitle'
          : 'studioChat.ask.pictureTitle',
      )}
    >
      <span className="studio-chat__ask-mark" aria-hidden="true">
        <Glyph name="image" />
      </span>
      <div className="studio-chat__ask-content">
        {ask.kind === 'connect' ? (
          <ConnectCard ask={ask} codex={codex?.codex ?? ask.codex} />
        ) : (
          <PictureCard ask={ask} />
        )}
      </div>
    </section>
  );
}
